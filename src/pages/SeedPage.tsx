import { useState } from 'react';
import { seedJcbUser } from '@/lib/seed-jcb';
import { seedBoards } from '@/lib/seed-boards';
import { seedTalkyBot } from '@/lib/seed-talky';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export default function SeedPage() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [bitcoinAddress, setBitcoinAddress] = useState('');
  const [status, setStatus] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [boardsLoading, setBoardsLoading] = useState(false);
  const [talkyLoading, setTalkyLoading] = useState(false);

  const handleSeedBoards = async () => {
    setBoardsLoading(true);
    setStatus('Creating Music and Gif boards...');
    try {
      await seedBoards();
      setStatus('✅ Boards seeded successfully! Music and Gif boards are now available.');
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setBoardsLoading(false);
    }
  };

  const handleSeedTalky = async () => {
    setTalkyLoading(true);
    setStatus('Creating Talky AI bot...');
    try {
      await seedTalkyBot();
      setStatus('✅ Talky bot seeded successfully! The AI bot is now online and ready to chat.');
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setTalkyLoading(false);
    }
  };

  const handleSeed = async () => {
    if (!username.trim() || !email.trim() || !password.trim() || !bitcoinAddress.trim()) {
      setStatus('❌ Error: All fields are required');
      return;
    }

    setLoading(true);
    setStatus(`Seeding user ${username} with real Bitcoin address...`);
    try {
      const result = await seedJcbUser({
        username,
        email,
        password,
        bitcoinAddress
      });
      setStatus(
        `✅ User seeded successfully!\\n\\nAccount Information:\\n` +
        `Email: ${result.credentials.email}\\n` +
        `Username: ${result.credentials.username}\\n` +
        `Bitcoin Address: ${result.credentials.bitcoinAddress}\\n` +
        `User ID: ${result.credentials.userId}\\n\\n` +
        `Backup file has been downloaded.\\n` +
        `Password was used for account creation but is not retained.`
      );
      // Clear form on success
      setUsername('');
      setEmail('');
      setPassword('');
      setBitcoinAddress('');
    } catch (error) {
      setStatus(`❌ Error: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-black p-8">
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold mb-4 font-mono">Seed User Account</h1>
        
        <div className="border-2 border-black p-4 mb-6 font-mono bg-blue-50">
          <h2 className="font-bold mb-2 text-blue-900">ℹ️ Admin Seeding Tool</h2>
          <p className="text-blue-900 mb-4">
            This tool creates a new user account with real credentials and Bitcoin address.
            No fake or hardcoded addresses - each user must have their own valid Bitcoin address.
          </p>
        </div>

        <div className="mb-6 p-4 bg-purple-50 border-2 border-purple-200 font-mono">
          <h2 className="font-bold mb-2 text-purple-900">🎮 Seed Boards</h2>
          <p className="text-purple-900 text-sm mb-3">
            Create the Music board and Gif board (GIF and WebM only) for the imageboard.
          </p>
          <Button 
            onClick={handleSeedBoards} 
            disabled={boardsLoading}
            className="w-full"
          >
            {boardsLoading ? 'Seeding Boards...' : 'Create Music & Gif Boards'}
          </Button>
        </div>

        <div className="mb-6 p-4 bg-cyan-50 border-2 border-cyan-200 font-mono">
          <h2 className="font-bold mb-2 text-cyan-900">🤖 Seed Talky AI Bot</h2>
          <p className="text-cyan-900 text-sm mb-3">
            Create Talky, the AI bot that appears as a permanent user in the chat. 
            Talky will automatically respond when the chat is slow or when mentioned with @talky.
          </p>
          <Button 
            onClick={handleSeedTalky} 
            disabled={talkyLoading}
            className="w-full"
          >
            {talkyLoading ? 'Creating Talky...' : 'Create Talky AI Bot'}
          </Button>
        </div>

        <div className="border-2 border-black p-6 mb-6 font-mono space-y-4">
          <div>
            <Label className="font-bold text-black" htmlFor="username">
              Username
            </Label>
            <Input
              id="username"
              placeholder="e.g., satoshi, alice, bob"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              className="mt-2 font-mono border-2 border-black"
            />
          </div>

          <div>
            <Label className="font-bold text-black" htmlFor="email">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="e.g., user@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={loading}
              className="mt-2 font-mono border-2 border-black"
            />
          </div>

          <div>
            <Label className="font-bold text-black" htmlFor="password">
              Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="Strong password required"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              className="mt-2 font-mono border-2 border-black"
            />
          </div>

          <div>
            <Label className="font-bold text-black" htmlFor="bitcoinAddress">
              Bitcoin Address (Real - No Satoshi Addresses!)
            </Label>
            <Input
              id="bitcoinAddress"
              placeholder="e.g., 1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2"
              value={bitcoinAddress}
              onChange={(e) => setBitcoinAddress(e.target.value)}
              disabled={loading}
              className="mt-2 font-mono border-2 border-black"
            />
            <p className="text-xs text-gray-600 mt-1">
              Enter a real Bitcoin address (Legacy, SegWit, or Taproot format)
            </p>
          </div>
        </div>

        <Button 
          onClick={handleSeed} 
          disabled={loading || !username.trim() || !email.trim() || !password.trim() || !bitcoinAddress.trim()}
          className="mb-4 w-full"
        >
          {loading ? 'Seeding...' : 'Create User Account'}
        </Button>

        {status && (
          <div className={`border-2 border-black p-4 font-mono whitespace-pre-wrap ${
            status.includes('✅') ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'
          }`}>
            {status}
          </div>
        )}

        <div className="mt-8 text-sm font-mono text-gray-600">
          <h3 className="font-bold mb-2">What this does:</h3>
          <ul className="list-disc ml-6 space-y-1">
            <li>Creates a new user account via Blink authentication system</li>
            <li>Validates Bitcoin address format</li>
            <li>Passwords are NOT stored or retained anywhere - use them during account creation only</li>
            <li>The backup file contains account information in plain text - store securely</li>
            <li>Never commit backup files to version control</li>
          </ul>
        </div>

        <div className="mt-8 p-4 bg-yellow-50 border-2 border-yellow-200 font-mono">
          <h3 className="font-bold mb-2 text-yellow-900">⚠️ Important Notes:</h3>
          <ul className="list-disc ml-6 space-y-1 text-yellow-900 text-sm">
            <li>Use REAL Bitcoin addresses only - no hardcoded or test addresses</li>
            <li>Each user must have their own unique address</li>
            <li>The backup file contains account information in plain text - store securely</li>
            <li>Never commit backup files to version control</li>
          </ul>
        </div>
      </div>
    </div>
  );
}