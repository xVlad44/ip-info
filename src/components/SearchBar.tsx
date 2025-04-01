'use client';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Search } from 'lucide-react';
import { useState } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';

type SearchBarProps = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  onIpDataChange: (data: any) => void;
}

export function SearchBar({ onIpDataChange }: SearchBarProps) {
  const router = useRouter();
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSearch = async () => {
    if (!inputValue.trim()) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Determine if input is IPv4, IPv6, or domain
      let endpoint = inputValue;
      
      // If it's "me" or empty, use the user's IP
      if (inputValue === "me" || inputValue === "") {
        endpoint = "";
      }
      
      const response = await axios.get(`https://ipapi.co/${endpoint}/json/`);
      const data = response.data;
      
      if (data.error) {
        setError(data.reason || "Invalid IP or domain");
        onIpDataChange(null);
      } else {
        console.log(data);
        onIpDataChange(data);
        
        // Store data in sessionStorage for persistence between pages
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        sessionStorage.setItem('ipLookupData', JSON.stringify(data));
        
        // Redirect to ip-lookup page
        router.push(`/tools/ip-lookup?ip=${encodeURIComponent(endpoint || data.ip)}`);
      }
    } catch (err:any) {
      setError(err.response?.data?.reason || "Failed to fetch IP data");
      onIpDataChange(null);
    } finally {
      setIsLoading(false);
      setInputValue('');
    }
  };

  return (
    <div className="p-4">
      <div className="flex rounded-lg overflow-hidden border border-input">
        <Input 
          type="text" 
          placeholder="IPV4 / IPV6 / Domain" 
          className="w-full px-4 py-2 focus:outline-none border-0 focus:ring-0 rounded-none"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
        />
        <Button 
          variant="ghost" 
          className="rounded-none border-0 hover:bg-muted hover:text-sky-500"
          onClick={handleSearch}
          disabled={isLoading}
        >
          {isLoading ? (
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-sky-500 border-t-transparent" />
          ) : (
            <Search className="w-4 h-4" />
          )}
        </Button>
      </div>
      {error && (
        <div className="mt-2 text-red-500 text-sm">{error}</div>
      )}
    </div>
  );
}