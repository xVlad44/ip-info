'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { MoveLeft, Globe, Check, X, Shield, Server } from 'lucide-react';
import Link from 'next/link';
import axios from 'axios';

export default function CloudflareCheckerPage() {
    const [domain, setDomain] = useState('');
    const [results, setResults] = useState<null | {
        usingCloudflare: boolean;
        headers?: Record<string, string>;
        cfRay?: string;
        cfCacheStatus?: string;
        server?: string;
    }>(null);
    const [, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const checkDomain = async () => {
        if (!domain) {
            setError('Please enter a domain');
            return;
        }

        // Format domain properly
        let formattedDomain = domain.trim().toLowerCase();
        if (!formattedDomain.startsWith('http://') && !formattedDomain.startsWith('https://')) {
            formattedDomain = 'https://' + formattedDomain;
        }
        console.log('Formatted Domain:', formattedDomain);
        setIsLoading(true);
        setError(null);
        setResults(null);

        try {
            // Use a CORS proxy to make the request
            const response = await axios.get(`https://api.allorigins.win/get?url=${encodeURIComponent(formattedDomain)}`);
            
            // Parse the response headers from the status object
            const headersString = response.data.status.headers;
            const headers: Record<string, string> = {};
            
            // Convert headers from object to key-value pairs
            if (headersString) {
                Object.entries(headersString).forEach(([key, value]) => {
                    if (typeof value === 'string') {
                        headers[key.toLowerCase()] = value;
                    }
                });
            }
            
            // Check for Cloudflare indicators
            const cfRay = headers['cf-ray'];
            const cfCacheStatus = headers['cf-cache-status'];
            const server = headers['server'];
            
            // Determine if site is using Cloudflare
            const usingCloudflare = !!(
                cfRay || 
                cfCacheStatus || 
                (server && server.toLowerCase().includes('cloudflare'))
            );
            
            setResults({
                usingCloudflare,
                headers,
                cfRay,
                cfCacheStatus,
                server
            });
            
        } catch (err) {
            console.error(err);
            setError('Failed to check domain. Make sure it is accessible.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col space-y-6 p-4">
            {/* Back Button */}
            <Button variant="ghost" className="flex items-center w-fit hover:text-sky-500" asChild>
                <Link href="/">
                    <MoveLeft className="mr-2 h-4 w-4" />
                    Back to Tools
                </Link>
            </Button>

            {/* Title */}
            <h1 className="text-3xl font-bold">Cloudflare Checker</h1>
            
            {/* Description */}
            <p className="text-lg">
                Check if a website is using Cloudflare for protection, CDN, or DNS services.
            </p>
            
            {/* Input Form */}
            <div className="flex flex-col space-y-4 md:flex-row md:space-y-0 md:space-x-2">
                <div className="flex-grow">
                    <Input
                        type="text"
                        placeholder="Enter domain name (e.g., example.com)"
                        value={domain}
                        onChange={(e) => setDomain(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && checkDomain()}
                    />
                </div>
                <Button 
                    onClick={checkDomain}
                    disabled={true}
                    className="w-full md:w-auto"
                >
                    {/* {isLoading ? "Checking..." : "Check Domain"} */}
                    Soon
                </Button>
            </div>
            
            {/* Error Message */}
            {error && (
                <div className="p-4 border border-red-300 bg-red-50 text-red-600 rounded-md">
                    {error}
                </div>
            )}
            
            {/* Results */}
            {results && (
                <div className="space-y-4">
                    <div className="p-6 border rounded-md bg-card">
                        <div className="flex items-center mb-4">
                            <Globe className="h-6 w-6 mr-2" />
                            <h2 className="text-xl font-semibold">{domain}</h2>
                        </div>
                        
                        <div className="flex items-center space-x-2 mb-6">
                            {results.usingCloudflare ? (
                                <>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-green-100">
                                        <Check className="h-5 w-5 text-green-600" />
                                    </div>
                                    <span className="text-lg font-medium text-green-600">
                                        This website is using Cloudflare
                                    </span>
                                </>
                            ) : (
                                <>
                                    <div className="flex h-8 w-8 items-center justify-center rounded-full bg-red-100">
                                        <X className="h-5 w-5 text-red-600" />
                                    </div>
                                    <span className="text-lg font-medium text-red-600">
                                        No Cloudflare detected
                                    </span>
                                </>
                            )}
                        </div>
                        
                        {results.usingCloudflare && (
                            <div className="space-y-3">
                                <h3 className="text-lg font-medium">Detected Cloudflare indicators:</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                    {results.cfRay && (
                                        <div className="flex items-center p-3 rounded-md border bg-background">
                                            <Shield className="h-5 w-5 mr-2 text-sky-500" />
                                            <div>
                                                <p className="font-medium">CF-Ray Header</p>
                                                <p className="text-sm opacity-80">{results.cfRay}</p>
                                            </div>
                                        </div>
                                    )}
                                    {results.cfCacheStatus && (
                                        <div className="flex items-center p-3 rounded-md border bg-background">
                                            <Server className="h-5 w-5 mr-2 text-sky-500" />
                                            <div>
                                                <p className="font-medium">CF-Cache-Status</p>
                                                <p className="text-sm opacity-80">{results.cfCacheStatus}</p>
                                            </div>
                                        </div>
                                    )}
                                    {results.server && results.server.toLowerCase().includes('cloudflare') && (
                                        <div className="flex items-center p-3 rounded-md border bg-background">
                                            <Server className="h-5 w-5 mr-2 text-sky-500" />
                                            <div>
                                                <p className="font-medium">Server Header</p>
                                                <p className="text-sm opacity-80">{results.server}</p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}