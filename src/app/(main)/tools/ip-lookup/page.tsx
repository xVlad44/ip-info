'use client';

import {
    MoveLeft,
    ChevronDown,
    MapPin,
    X
} from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { useState, useEffect, Suspense } from 'react';
import axios from 'axios';
import { useSearchParams, useRouter } from 'next/navigation';
import { 
    Collapsible, 
    CollapsibleContent, 
    CollapsibleTrigger 
} from "@/components/ui/collapsible";
import { 
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogTrigger
} from "@/components/ui/dialog";
import dynamic from 'next/dynamic';

// Dynamically import the map component to avoid SSR issues
const MapComponent = dynamic(() => import('@/components/MapComp'), {
  ssr: false,
  loading: () => <div className="h-[400px] w-full flex items-center justify-center">Loading map...</div>
});

type IpData = {
    ip: string;
    city: string;
    region: string;
    country_name: string;
    org?: string;
    asn?: string;
    timezone?: string;
    postal?: string;
    latitude: number;
    longitude: number;
};

function IpLookupContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const ipParam = searchParams.get('ip');
    
    const [ipData, setIpData] = useState<IpData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isOpen, setIsOpen] = useState(true);
    const [mapDialogOpen, setMapDialogOpen] = useState(false);

    useEffect(() => {
        // Try to get data from sessionStorage first
        const storedData = sessionStorage.getItem('ipLookupData');
        
        if (storedData) {
            setIpData(JSON.parse(storedData));
            return;
        }
        
        // If there's an IP parameter but no stored data, fetch data for that IP
        if (ipParam) {
            const fetchIpData = async () => {
                try {
                    setIsLoading(true);
                    setError(null);
                    const endpoint = ipParam === 'me' ? '' : ipParam;
                    const response = await axios.get(`https://ipapi.co/${endpoint}/json/`);
                    const data = response.data;
                    
                    if (data.error) {
                        setError(data.reason || "Invalid IP or domain");
                    } else {
                        setIpData(data);
                        sessionStorage.setItem('ipLookupData', JSON.stringify(data));
                    }
                } catch (err) {
                    setError('Failed to fetch IP data. Please try again later.');
                    console.error(err);
                } finally {
                    setIsLoading(false);
                }
            };
            
            fetchIpData();
        }
    }, [ipParam]);
    
    const handleClear = () => {
        // Clear the stored IP data
        sessionStorage.removeItem('ipLookupData');
        setIpData(null);
        setError(null);
        
        // Redirect to the same page without IP parameter
        router.push('/tools/ip-lookup');
    };
    
    return (
        <div className="flex flex-col space-y-6 p-4">
            {/* Back Button */}
            <div className="flex justify-between items-center">
                <Button variant="ghost" className="flex items-center w-fit hover:text-sky-500" asChild>
                    <Link href="/">
                        <MoveLeft className="mr-2 h-4 w-4" />
                        Back to Tools
                    </Link>
                </Button>
                
                {ipData && (
                    <Button 
                        variant="outline" 
                        size="sm" 
                        className="hover:text-red-500 hover:border-red-500"
                        onClick={handleClear}
                    >
                        <X className="mr-2 h-4 w-4" />
                        Clear
                    </Button>
                )}
            </div>

            {/* Title */}
            <h1 className="text-3xl font-bold">IP Lookup</h1>
            
            {/* Description */}
            <p className="text-lg">
                {ipData 
                    ? `Displaying information for IP address ${ipData.ip}`
                    : "Enter an IP address or domain in the search box to look up its information."}
            </p>
            
            {/* IP Data Section */}
            {isLoading ? (
                <div className="flex justify-center py-8">
                    <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"></div>
                </div>
            ) : error ? (
                <div className="p-4 border border-red-300 bg-red-50 text-red-700 rounded-md">
                    {error}
                </div>
            ) : ipData && (
                <Collapsible 
                    open={isOpen} 
                    onOpenChange={setIsOpen} 
                    className="border rounded-md"
                >
                    <CollapsibleTrigger asChild>
                        <Button 
                            variant="ghost" 
                            className="flex items-center justify-between w-full p-4 text-xl font-medium"
                        >
                            <span>IP Information</span>
                            <ChevronDown className={`h-5 w-5 transition-transform ${isOpen ? 'transform rotate-180' : ''}`} />
                        </Button>
                    </CollapsibleTrigger>
                    
                    <CollapsibleContent>
                        <div className="p-4 space-y-4">
                            <table className="w-full border-collapse">
                                <tbody>
                                    <tr className="border-b">
                                        <td className="py-2 font-medium">IP Address</td>
                                        <td className="py-2">{ipData.ip}</td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-2 font-medium">Location</td>
                                        <td className="py-2">{ipData.city}, {ipData.region}, {ipData.country_name}</td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-2 font-medium">ISP</td>
                                        <td className="py-2">{ipData.org || 'N/A'}</td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-2 font-medium">ASN</td>
                                        <td className="py-2">{ipData.asn || 'N/A'}</td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-2 font-medium">Timezone</td>
                                        <td className="py-2">{ipData.timezone || 'N/A'}</td>
                                    </tr>
                                    <tr className="border-b">
                                        <td className="py-2 font-medium">Postal Code</td>
                                        <td className="py-2">{ipData.postal || 'N/A'}</td>
                                    </tr>
                                    <tr className='py-2'>
                                        <td className="py-2 font-medium">Coordinates </td>
                                        <td className="py-2 flex items-center justify-between">
                                            <span>{ipData.latitude}, {ipData.longitude}</span>
                                            <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
                                                <DialogTrigger asChild>
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        className="ml-2 hover:text-sky-500"
                                                    >
                                                        <MapPin className="w-4 h-4 mr-1" />
                                                        View on Map
                                                    </Button>
                                                </DialogTrigger>
                                                <DialogContent className="sm:max-w-[725px]">
                                                    <DialogHeader>
                                                        <DialogTitle>Location Map</DialogTitle>
                                                    </DialogHeader>
                                                    <div className="h-[400px] w-full">
                                                        <MapComponent 
                                                            lat={ipData.latitude} 
                                                            lon={ipData.longitude} 
                                                            city={ipData.city} 
                                                            country={ipData.country_name} 
                                                        />
                                                    </div>
                                                </DialogContent>
                                            </Dialog>
                                        </td>
                                    </tr>
                                </tbody>
                            </table>
                        </div>
                    </CollapsibleContent>
                </Collapsible>
            )}
        </div>
    );
}

export default function IpLookupPage() {
    return (
        <Suspense fallback={<div className="flex justify-center py-8">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-sky-500 border-t-transparent"></div>
        </div>}>
            <IpLookupContent />
        </Suspense>
    );
}