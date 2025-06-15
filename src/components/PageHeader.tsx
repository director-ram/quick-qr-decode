
import React from "react";
import { QrCode, Sparkles } from "lucide-react";

const PageHeader: React.FC = () => (
  <div className="text-center mb-12 slide-in-top">
    <div className="flex items-center justify-center gap-3 mb-4">
      <div className="p-3 bg-gradient-to-r from-purple-500 to-pink-500 rounded-2xl glow-effect">
        <QrCode className="h-8 w-8 text-white" />
      </div>
      <h1 className="text-5xl font-bold gradient-text">HAG's QR Scanner</h1>
      <Sparkles className="h-6 w-6 text-yellow-500 float-animation" />
    </div>
    <p className="text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
      Generate, scan, and manage QR codes with ease using our modern, interactive platform
    </p>
  </div>
);

export default PageHeader;
