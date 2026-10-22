import type {Metadata} from 'next';
import './globals.css';
export const metadata:Metadata={title:'DYC Care · Camp Victory',icons:{icon:'/dyc-icon.png',apple:'/dyc-icon.png'},description:'Diabetes Youth Care camp monitoring workspace for approved care-team staff.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><head><link rel="preload" href="/fonts/public-sans-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /><link rel="preload" href="/fonts/bricolage-grotesque-latin.woff2" as="font" type="font/woff2" crossOrigin="anonymous" /></head><body>{children}</body></html>;}
