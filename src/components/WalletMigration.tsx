import { useState, useCallback } from 'react'
import { useAccount, useSignMessage, useDisconnect } from 'wagmi'
import crypto from '../utils/crypto'

interface WalletData {
  user?: string
  name?: string
  network?: string
  address: string
  privateKey: string
  encryptedPrivateKey?: string // Support both field names
  isMain?: boolean
  [key: string]: any
}

interface MigrationComponentProps {
  walletLabel: 'Old Wallet' | 'New Wallet'
  onSignatureObtained?: (signature: string, address: string) => void
}

function WalletConnectionSection({
  walletLabel,
  onSignatureObtained,
  storedSignature,
  storedAddress
}: MigrationComponentProps & {
  storedSignature?: string | null
  storedAddress?: string | null
}) {
  const { address, isConnected } = useAccount()
  const { signMessageAsync } = useSignMessage()
  const { disconnect } = useDisconnect()
  const [signingMessage, setSigningMessage] = useState('insidor_dapp')
  const [isSigning, setIsSigning] = useState(false)

  const handleSign = useCallback(async () => {
    if (!signingMessage.trim() || !isConnected || !address) {
      alert('Please connect wallet and enter a signing message')
      return
    }

    try {
      setIsSigning(true)
      const sig = await signMessageAsync({ message: signingMessage })
      onSignatureObtained?.(sig, address)
      // Automatically disconnect after signing to allow next wallet connection
      setTimeout(() => {
        disconnect()
      }, 1000)
    } catch (error) {
      console.error('Signing error:', error)
      alert('Failed to sign message. Please try again.')
    } finally {
      setIsSigning(false)
    }
  }, [signingMessage, isConnected, address, signMessageAsync, onSignatureObtained, disconnect])

  const isComplete = !!storedSignature && !!storedAddress

  return (
    <section style={{
      marginBottom: '20px',
      opacity: isComplete ? 0.8 : 1,
      borderColor: isComplete ? '#4caf50' : undefined,
      borderWidth: isComplete ? '2px' : undefined
    }}>
      <h2>{walletLabel}</h2>

      {isComplete ? (
        <div style={{
          padding: '15px',
          backgroundColor: '#e8f5e9',
          borderRadius: '6px',
          marginBottom: '15px'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>✓ Completed</strong>
          </div>
          <div style={{ fontSize: '12px', marginBottom: '5px' }}>
            <strong>Address:</strong> {storedAddress}
          </div>
          <div style={{ fontSize: '12px' }}>
            <strong>Signature:</strong> {'*'.repeat(64)}
          </div>
        </div>
      ) : (
        <>
          <div style={{ marginBottom: '15px' }}>
            <label style={{ display: 'block', marginBottom: '8px', fontWeight: '600' }}>
              Signing Message:
            </label>
            <textarea
              value={signingMessage}
              onChange={(e) => setSigningMessage(e.target.value)}
              placeholder={`Enter message to sign for ${walletLabel.toLowerCase()}`}
              style={{
                width: '100%',
                padding: '10px',
                border: '2px solid #e0e0e0',
                borderRadius: '6px',
                minHeight: '80px',
                fontFamily: 'inherit',
                fontSize: '14px',
                resize: 'vertical'
              }}
            />
          </div>

          <div style={{ marginBottom: '15px' }}>
            {isConnected && address ? (
              <div>
                <p style={{ marginBottom: '10px' }}>
                  <strong>Connected:</strong> {address}
                </p>
                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    onClick={handleSign}
                    disabled={isSigning || !signingMessage.trim()}
                    style={{
                      opacity: (isSigning || !signingMessage.trim()) ? 0.6 : 1,
                      cursor: (isSigning || !signingMessage.trim()) ? 'not-allowed' : 'pointer'
                    }}
                  >
                    {isSigning ? 'Signing...' : 'Sign Message'}
                  </button>
                  <button
                    onClick={() => disconnect()}
                    style={{ backgroundColor: '#ff4444', color: 'white', borderColor: '#ff4444' }}
                  >
                    Disconnect
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <appkit-button />
              </div>
            )}
          </div>
        </>
      )}
    </section>
  )
}

export function WalletMigration() {
  const [oldWalletAddress, setOldWalletAddress] = useState<string | null>(null)
  const [oldWalletSignature, setOldWalletSignature] = useState<string | null>(null)
  const [newWalletAddress, setNewWalletAddress] = useState<string | null>(null)
  const [newWalletSignature, setNewWalletSignature] = useState<string | null>(null)
  const [walletFiles, setWalletFiles] = useState<File[]>([])
  const [walletFilesData, setWalletFilesData] = useState<Array<{ file: File; data: WalletData | WalletData[] }>>([])
  const [isMigrating, setIsMigrating] = useState(false)
  const [migratedFiles, setMigratedFiles] = useState<Array<{ filename: string; data: string }>>([])

  const handleOldWalletSignature = useCallback((signature: string, address: string) => {
    setOldWalletSignature(signature)
    setOldWalletAddress(address)
  }, [])

  const handleNewWalletSignature = useCallback((signature: string, address: string) => {
    setNewWalletSignature(signature)
    setNewWalletAddress(address)
  }, [])

  const handleFileUpload = useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    if (files.length === 0) return

    const fileDataPromises = files.map((file) => {
      return new Promise<{ file: File; data: WalletData | WalletData[] }>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          try {
            const json = JSON.parse(e.target?.result as string)
            resolve({ file, data: json })
          } catch (error) {
            reject(new Error(`Invalid JSON in ${file.name}: ${error}`))
          }
        }
        reader.onerror = () => reject(new Error(`Failed to read ${file.name}`))
        reader.readAsText(file)
      })
    })

    Promise.all(fileDataPromises)
      .then((results) => {
        setWalletFiles(files)
        setWalletFilesData(results)
        const totalWallets = results.reduce((sum, r) => sum + (Array.isArray(r.data) ? r.data.length : 1), 0)
        alert(`Loaded ${files.length} file(s) with ${totalWallets} wallet(s) total`)
      })
      .catch((error) => {
        alert(`Error loading files: ${error.message}`)
        console.error(error)
      })
  }, [])

  const decrypt = (encryptedData: string, signature: string): string => {
    try {
      return crypto.decrypt(encryptedData, signature)
    } catch (error) {
      console.error('Decryption error:', error)
      throw new Error('Failed to decrypt. Please check if the old wallet signature is correct.')
    }
  }

  const encrypt = (data: string, signature: string): string => {
    try {
      return crypto.encrypt(data, signature)
    } catch (error) {
      console.error('Encryption error:', error)
      throw new Error('Failed to encrypt')
    }
  }

  const parseFilename = (filename: string) => {
    // Pattern: timestamp-accounts count-network name-connected wallet address-accounts.json
    // Network name can contain hyphens, so we match from account count until the wallet address (starts with 0x)
    const match = filename.match(/^(\d{14})-(\d+)-(.+?)-(0x[0-9a-fA-F]+)-accounts\.json$/)
    if (match) {
      return {
        timestamp: match[1],
        accountCount: parseInt(match[2]),
        network: match[3],
        walletAddress: match[4]
      }
    }
    return null
  }

  const generateFilename = (originalFilename: string, walletCount: number, newWalletAddress: string | null) => {
    const parsed = parseFilename(originalFilename)
    // Generate timestamp in YYYYMMDDHHmmss format (14 digits)
    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hours = String(now.getHours()).padStart(2, '0')
    const minutes = String(now.getMinutes()).padStart(2, '0')
    const seconds = String(now.getSeconds()).padStart(2, '0')
    const timestamp = `${year}${month}${day}${hours}${minutes}${seconds}`
    
    if (parsed && newWalletAddress) {
      // Use network from original filename, new timestamp, wallet count, and new wallet address
      return `${timestamp}-${walletCount}-${parsed.network}-${newWalletAddress.toLowerCase()}-accounts.json`
    } else {
      // Fallback if filename doesn't match pattern
      const baseName = originalFilename.replace(/\.json$/, '')
      return `${timestamp}-${walletCount}-${baseName}-${newWalletAddress?.toLowerCase() || 'migrated'}-accounts.json`
    }
  }

  const handleMigrate = useCallback(() => {
    if (!oldWalletSignature || !newWalletSignature || !walletFilesData.length) {
      alert('Please ensure both wallets are connected and signed, and wallet file(s) are uploaded')
      return
    }

    setIsMigrating(true)
    try {
      const migratedFilesData: Array<{ filename: string; data: string }> = []

      walletFilesData.forEach((fileData) => {
        try {
          // Handle both array and single object formats
          const wallets = Array.isArray(fileData.data) ? fileData.data : [fileData.data]
          const migratedWallets = wallets.map((wallet) => {
            try {
              // Support both 'privateKey' and 'encryptedPrivateKey' field names
              const encryptedKey = wallet.privateKey || wallet.encryptedPrivateKey
              if (!encryptedKey) {
                throw new Error(`Wallet ${wallet.address} missing encrypted private key`)
              }

              // Decrypt with old wallet signature
              const decryptedPk = decrypt(encryptedKey, oldWalletSignature)

              // Encrypt with new wallet signature
              const newEncryptedPk = encrypt(decryptedPk, newWalletSignature)

              // Keep all fields as-is, only update privateKey
              return {
                ...wallet,
                privateKey: newEncryptedPk
              }
            } catch (error) {
              console.error(`Failed to migrate wallet ${wallet.address}:`, error)
              throw error
            }
          })

          // Preserve original format: if input was single object, export as single object
          const output = Array.isArray(fileData.data) ? migratedWallets : migratedWallets[0]
          const jsonOutput = JSON.stringify(output, null, 2)
          
          // Generate new filename following the naming convention
          const newFilename = generateFilename(fileData.file.name, migratedWallets.length, newWalletAddress)
          
          migratedFilesData.push({
            filename: newFilename,
            data: jsonOutput
          })
        } catch (error) {
          console.error(`Failed to migrate file ${fileData.file.name}:`, error)
          throw error
        }
      })

      setMigratedFiles(migratedFilesData)
      alert(`Successfully migrated ${walletFilesData.length} file(s)!`)
    } catch (error) {
      console.error('Migration error:', error)
      alert(`Migration failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsMigrating(false)
    }
  }, [oldWalletSignature, newWalletSignature, walletFilesData, oldWalletAddress, newWalletAddress])

  const handleExport = useCallback(() => {
    if (!migratedFiles.length) {
      alert('No migrated data to export')
      return
    }

    // Export all files
    migratedFiles.forEach((fileData) => {
      const blob = new Blob([fileData.data], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = fileData.filename
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    })
    
    alert(`Exported ${migratedFiles.length} file(s)!`)
  }, [migratedFiles])

  return (
    <div className="pages" style={{ maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1>Wallet Migration Tool</h1>

      <p className="advice">
        <strong>Instructions:</strong> Connect the old wallet first, enter a signing message and sign it.
        Then disconnect and connect the new wallet, enter its signing message and sign it.
        Upload one or more wallet JSON files and click "Start Migration" to migrate all wallets.
      </p>

      <WalletConnectionSection
        walletLabel="Old Wallet"
        onSignatureObtained={handleOldWalletSignature}
        storedSignature={oldWalletSignature}
        storedAddress={oldWalletAddress}
      />

      <WalletConnectionSection
        walletLabel="New Wallet"
        onSignatureObtained={handleNewWalletSignature}
        storedSignature={newWalletSignature}
        storedAddress={newWalletAddress}
      />

      <section>
        <h2>Upload Wallet Files</h2>
        <div style={{ marginBottom: '15px' }}>
          <input
            type="file"
            accept=".json"
            multiple
            onChange={handleFileUpload}
            style={{
              padding: '8px',
              border: '2px solid #e0e0e0',
              borderRadius: '6px',
              width: '100%'
            }}
          />
        </div>
        {walletFilesData.length > 0 && (
          <div style={{
            padding: '10px',
            backgroundColor: '#e3f2fd',
            borderRadius: '6px',
            fontSize: '12px'
          }}>
            <strong>Loaded:</strong> {walletFilesData.length} file(s) with{' '}
            {walletFilesData.reduce((sum, f) => sum + (Array.isArray(f.data) ? f.data.length : 1), 0)} wallet(s) total
            <div style={{ marginTop: '8px', fontSize: '11px' }}>
              {walletFiles.map((f, i) => (
                <div key={i}>• {f.name}</div>
              ))}
            </div>
          </div>
        )}
      </section>

      <section>
        <h2>Migration Status</h2>
        <div style={{ marginBottom: '15px' }}>
          <div style={{ marginBottom: '10px' }}>
            <strong>Old Wallet:</strong>{' '}
            {oldWalletSignature ? '✓ Signed' : '✗ Not signed'}
            {oldWalletAddress && ` (${oldWalletAddress})`}
          </div>
          <div style={{ marginBottom: '10px' }}>
            <strong>New Wallet:</strong>{' '}
            {newWalletSignature ? '✓ Signed' : '✗ Not signed'}
            {newWalletAddress && ` (${newWalletAddress})`}
          </div>
          <div>
            <strong>Wallet Files:</strong> {walletFilesData.length > 0 ? `✓ ${walletFilesData.length} file(s) loaded` : '✗ Not loaded'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <button
            onClick={handleMigrate}
            disabled={isMigrating || !oldWalletSignature || !newWalletSignature || !walletFilesData.length}
            style={{
              opacity: (isMigrating || !oldWalletSignature || !newWalletSignature || !walletFilesData.length) ? 0.6 : 1,
              cursor: (isMigrating || !oldWalletSignature || !newWalletSignature || !walletFilesData.length) ? 'not-allowed' : 'pointer',
              backgroundColor: '#4caf50',
              color: 'white',
              borderColor: '#4caf50'
            }}
          >
            {isMigrating ? 'Migrating...' : 'Start Migration'}
          </button>

          {migratedFiles.length > 0 && (
            <button
              onClick={handleExport}
              style={{
                backgroundColor: '#2196f3',
                color: 'white',
                borderColor: '#2196f3'
              }}
            >
              Export {migratedFiles.length} File(s)
            </button>
          )}
        </div>
      </section>

      {migratedFiles.length > 0 && (
        <section>
          <h2>Migration Preview</h2>
          <div style={{ fontSize: '12px', marginBottom: '10px' }}>
            <strong>Migrated Files:</strong>
          </div>
          {migratedFiles.map((file, index) => (
            <div key={index} style={{
              padding: '10px',
              backgroundColor: '#f5f5f5',
              borderRadius: '6px',
              marginBottom: '10px',
              fontSize: '11px'
            }}>
              <div style={{ fontWeight: '600', marginBottom: '5px' }}>{file.filename}</div>
              <pre style={{
                padding: '10px',
                backgroundColor: '#ffffff',
                borderRadius: '4px',
                maxHeight: '150px',
                overflow: 'auto',
                fontSize: '10px',
                margin: '5px 0 0 0'
              }}>
                {file.data.substring(0, 300)}...
              </pre>
            </div>
          ))}
        </section>
      )}
    </div>
  )
}

