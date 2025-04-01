'use client';

import { Github } from 'lucide-react';
import { SearchBar } from '@/components/SearchBar';
import { useState } from 'react';

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const [, setIpData] = useState(null);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
      {/* Static Left Column */}
      <div className="flex flex-col space-y-6">
        {/* Text Section */}
        <div className="p-4">
          <h2 className="text-4xl font-bold mb-4">IP Info</h2>
          <p className="text-2xl">
            IP Info is a powerful set of tools that allows you to get information about an IP address.
          </p>
        </div>
        
        {/* Icon Section */}
        <div className="flex justify-center p-4">
          <a 
            href="https://github.com/xvlad44/ip-info" 
            target="_blank" 
            rel="noopener noreferrer"
            className="flex items-center space-x-2 hover:text-sky-500 transition-colors"
          >
            <Github className="w-6 h-6" />
            <span className="text-lg font-medium">Source Code</span>
          </a>
        </div>

        {/* Search Bar Section */}
        <SearchBar onIpDataChange={setIpData} />
      </div>
      
      {/* Dynamic Right Column */}
      {children}
    </div>
  );
}