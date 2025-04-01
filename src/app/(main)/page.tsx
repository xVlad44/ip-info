import { Button } from '@/components/ui/button';
import { 
  User,
  FileSearch,
  HardDriveDownload,
} from 'lucide-react';

import Link from 'next/link';


export default function Home() {
  const tools = [
    { id: 'my-ip', name: 'My IP Info', icon: User },
    { id: 'ip-lookup', name: 'IP Lookup', icon: FileSearch },
    { id: 'cloudflare-checker', name: 'Cloudflare Checker', icon: HardDriveDownload }
  ];

  return (

          
          <div className="flex flex-col space-y-6">
            <div className="p-4">
              <h2 className="text-4xl font-bold mb-6">IP Tools</h2>
              <div className="flex flex-col space-y-4">
                {tools.map(tool => (
                  <Button 
                    key={tool.id}
                    variant="ghost" 
                    className="flex items-center justify-start space-x-3 text-lg hover:text-sky-500 transition-colors"
                    asChild
                  >
                    <Link href={`/tools/${tool.id}`}>
                      <tool.icon className="w-5 h-5" />
                      <span>{tool.name}</span>
                    </Link>
                  </Button>
                ))}
             
            </div>
          </div>
        </div>

    
  );
}
