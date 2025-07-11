'use client';

import { useState, useEffect, useRef } from 'react';
import {
  useAccount,
  useReadContract,
  useWriteContract,
  useSimulateContract,
  useWaitForTransactionReceipt,
} from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { parseEther } from 'viem';

const contractAddress = '0xf9FEf2505A144a12119D9Ca3B9C662112Acd1BB3';
const ownerAddress = '0x5ad5F9C61d3D92EbAA6bFa2aA547c678a1983373'; // Ensure this is the correct owner address
const maxRaise = parseEther('10');

const contractAbi = [
  {
    name: 'totalRaised',
    type: 'function',
    stateMutability: 'view',
    inputs: [],
    outputs: [{ type: 'uint256' }],
  },
  {
    name: 'isWhitelisted',
    type: 'function',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ type: 'bool' }],
  },
  {
    name: 'contribute',
    type: 'function',
    stateMutability: 'payable',
    inputs: [],
    outputs: [],
  },
  {
    name: 'addBatchWhitelist',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'addresses', type: 'address[]' }],
    outputs: [],
  },
];

export default function Page() {
  const { address, isConnected } = useAccount();
  const [amount, setAmount] = useState('0.01');
  const [whitelisted, setWhitelisted] = useState<boolean | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [csvAddresses, setCsvAddresses] = useState<string[]>([]);
  const [uploadLog, setUploadLog] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  // State baru untuk menandakan apakah komponen sudah di-mount di sisi klien
  const [isClient, setIsClient] = useState(false);

  // useEffect untuk mengatur isClient setelah komponen di-mount
  useEffect(() => {
    setIsClient(true);
  }, []);

  // totalRaised
  const { data: raised } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'totalRaised',
    query: { refetchInterval: 1500 },
  });

  // Check whitelist
  const { data: whitelistStatus, isLoading: isWhitelistStatusLoading, error: whitelistError } = useReadContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'isWhitelisted',
    args: [address],
    query: { enabled: !!address && isClient }, // Hanya enable jika di klien
  });

  // Simulate contribute
  const { data: simulation, error: simulateError, isLoading: isSimulating } = useSimulateContract({
    address: contractAddress,
    abi: contractAbi,
    functionName: 'contribute',
    value: parseEther(amount || '0'),
    account: address,
    query: {
      enabled: !!address && !!amount && (whitelisted === true) && isClient, // Hanya enable jika di klien
    },
  });

  const { writeContractAsync, data: txData, isPending } = useWriteContract();

  const { isLoading: isConfirming, isSuccess } = useWaitForTransactionReceipt({
    hash: txData,
  });

  const handleContribute = async () => {
    console.log("Attempting to contribute...");
    console.log("Simulation data:", simulation);
    console.log("Is whitelisted:", whitelisted);
    console.log("Amount:", amount);

    if (!simulation) {
      alert('Contribution simulation not ready. Ensure you are connected, entered an amount, and are whitelisted.');
      return;
    }
    try {
      await writeContractAsync(simulation.request);
      alert('✅ Contribution successful!');
    } catch (err) {
      console.error("Transaction error:", err);
      alert('❌ Transaction failed. Check console for details.');
    }
  };

  // Owner & Whitelist state
  useEffect(() => {
    if (!address || !isClient) { // Pastikan hanya berjalan di klien
      console.log("No wallet connected or not yet on client side.");
      setIsOwner(false);
      setWhitelisted(false);
      return;
    }

    const currentAddressLower = address.toLowerCase();
    const ownerAddressLower = ownerAddress.toLowerCase();
    const isCurrentUserOwner = currentAddressLower === ownerAddressLower;

    console.log("Connected Address:", currentAddressLower);
    console.log("Owner Address (from code):", ownerAddressLower);
    console.log("Is current user owner?", isCurrentUserOwner);
    setIsOwner(isCurrentUserOwner);

    if (whitelistStatus !== undefined) {
      console.log("Whitelist Status from contract:", whitelistStatus);
      setWhitelisted(Boolean(whitelistStatus));
    } else {
      console.log("Whitelist status still loading or not available.");
      setWhitelisted(null);
    }
  }, [address, whitelistStatus, isClient]); // Tambahkan isClient sebagai dependensi

  // Debugging simulateError
  useEffect(() => {
    if (simulateError) {
      console.error("Simulation Error:", simulateError);
    }
  }, [simulateError]);

  // Upload CSV Logic
  const handleCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) {
      setCsvAddresses([]);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      const lines = result
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter((l) => /^0x[a-fA-F0-9]{40}$/.test(l));
      const unique = [...new Set(lines.map((a) => a.toLowerCase()))];
      console.log(`Found ${unique.length} valid and unique addresses from CSV.`);
      setCsvAddresses(unique);
    };
    reader.readAsText(file);
  };

  const handleUploadWhitelist = async () => {
    if (!csvAddresses.length) {
      alert("No valid addresses to upload.");
      return;
    }
    const batchSize = 150;
    setUploadLog('Starting batch upload...\n');
    for (let i = 0; i < Math.ceil(csvAddresses.length / batchSize); i++) {
      const batch = csvAddresses.slice(i * batchSize, (i + 1) * batchSize);
      try {
        console.log(`Uploading batch ${i + 1} with ${batch.length} addresses...`);
        await writeContractAsync({
          address: contractAddress,
          abi: contractAbi,
          functionName: 'addBatchWhitelist',
          args: [batch],
        });
        setUploadLog((log) => log + `✅ Batch ${i + 1} uploaded\n`);
      } catch (err) {
        console.error(`Error uploading batch ${i + 1}:`, err);
        setUploadLog((log) => log + `❌ Batch ${i + 1} failed\n`);
      }
    }
    setUploadLog((log) => log + "Upload finished.");
  };

  const raisedETH = raised ? Number(raised) / 1e18 : 0;
  const percentRaised = raised ? (Number(raised) * 100 / Number(maxRaise)).toFixed(2) : '0';

  return (
    <div className="container">
      <ConnectButton />

      <h1>🔒 Private Presale</h1>

      {/* Konten yang bergantung pada koneksi dompet hanya akan dirender setelah "hydration" */}
      {isClient && isConnected ? (
        <>
          <p><strong>Wallet:</strong> {address}</p>
          <p>
            <strong>Status:</strong>{' '}
            {whitelisted === null && isWhitelistStatusLoading ? 'Loading...' : (whitelisted ? '✅ Whitelisted' : '❌ Not Whitelisted')}
          </p>

          {whitelisted === false && (
            <div className="warning">
              Your wallet is not whitelisted. You cannot contribute.
            </div>
          )}

          <div className="progress-container">
            <label>Total Raised:</label>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${percentRaised}%` }}></div>
            </div>
            <div><strong>{raisedETH.toFixed(4)} / 10 ETH</strong> ({percentRaised}%)</div>
          </div>

          <input
            type="number"
            placeholder="Amount in ETH"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
          <button
            onClick={handleContribute}
            disabled={!simulation || isPending || isSimulating || !whitelisted}
          >
            {isPending ? 'Sending...' : (isSimulating ? 'Verifying...' : 'Contribute')}
          </button>

          {isConfirming && <p>⏳ Waiting for confirmation...</p>}
          {isSuccess && <p>✅ Contribution successful!</p>}
          {simulateError && <p style={{ color: 'red' }}>Simulation Error: {simulateError.message || 'An error occurred.'}</p>}
        </>
      ) : (
        // Ini adalah konten fallback yang akan selalu dirender di server dan di klien pada awalnya
        <p>Please connect your wallet to continue.</p>
      )}

      {/* Admin Panel juga hanya akan dirender setelah isClient true dan user adalah owner */}
      {isClient && isOwner && (
        <div style={{ marginTop: '2rem' }}>
          ---
          <h2>🛠 Admin Panel</h2>
          <input type="file" accept=".csv" ref={fileRef} onChange={handleCSV} />
          {csvAddresses.length > 0 && (
            <>
              <p>✅ **{csvAddresses.length} valid addresses found**</p>
              <textarea
                readOnly
                style={{ width: '100%', height: 120, resize: 'vertical' }}
                value={csvAddresses.join('\n')}
              ></textarea>
              <button onClick={handleUploadWhitelist} disabled={!csvAddresses.length}>
                Upload to Smart Contract
              </button>
              <pre style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-all', backgroundColor: '#eee', padding: '10px', borderRadius: '5px', marginTop: '10px' }}>{uploadLog}</pre>
            </>
          )}
          {!csvAddresses.length && fileRef.current?.files?.[0] && (
            <p style={{ color: 'orange' }}>No valid addresses found in the CSV file. Ensure the format is correct (one address per line).</p>
          )}
        </div>
      )}
    </div>
  );
}