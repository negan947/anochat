import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-anon-900 text-anon-100 flex items-center justify-center">
      <Card className="max-w-lg w-full mx-4" variant="glass">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl bg-gradient-to-r from-phantom-400 to-phantom-600 bg-clip-text text-transparent">
            Page Not Found
          </CardTitle>
        </CardHeader>
        <CardContent className="text-center space-y-6">
          <div className="w-16 h-16 mx-auto bg-gradient-to-br from-phantom-500 to-phantom-700 rounded-lg flex items-center justify-center">
            <span className="text-2xl">🔍</span>
          </div>
          
          <div className="space-y-2">
            <p className="text-anon-300">
              The page you&apos;re looking for doesn&apos;t exist.
            </p>
            <p className="text-sm text-anon-500">
              Your anonymity is still protected.
            </p>
          </div>
          
          <Link href="/">
            <Button variant="phantom" className="w-full">
              Return to AnoChat
            </Button>
          </Link>
          
          <div className="text-xs text-anon-500">
            🔒 Zero-Knowledge • 👻 Anonymous • 🌐 Encrypted
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 