import React from "react";
import { Github, Heart, Code } from "lucide-react";

const Footer: React.FC = () => {
  const currentYear = new Date().getFullYear();
  const githubRepoUrl = "https://github.com/director-ram/quick-qr-decode";

  return (
    <footer className="relative z-10 mt-16 border-t border-white/10 bg-gradient-to-b from-transparent to-black/20 backdrop-blur-sm">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-6">
          {/* Brand Section */}
          <div className="flex flex-col items-center md:items-start">
            <div className="flex items-center gap-2 mb-3">
              <img 
                src="/HAG.jpg" 
                alt="HAG's QR Scanner Logo" 
                className="h-8 w-8 rounded-lg object-cover"
              />
              <span className="text-lg font-bold text-white">HAG's QR Scanner</span>
            </div>
            <p className="text-sm text-gray-400 text-center md:text-left">
              A modern, interactive QR code scanner and generator built with React and TypeScript.
            </p>
          </div>

          {/* Links Section */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="text-sm font-semibold text-white mb-3">Resources</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a 
                  href={githubRepoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors flex items-center gap-2"
                >
                  <Github className="h-4 w-4" />
                  <span>GitHub Repository</span>
                </a>
              </li>
              <li>
                <a 
                  href="https://www.hagqrscanner.website"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-gray-400 hover:text-white transition-colors"
                >
                  Live Website
                </a>
              </li>
            </ul>
          </div>

          {/* Tech Stack Section */}
          <div className="flex flex-col items-center md:items-start">
            <h3 className="text-sm font-semibold text-white mb-3">Built With</h3>
            <ul className="space-y-2 text-sm text-gray-400">
              <li className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                <span>React + TypeScript</span>
              </li>
              <li className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                <span>Vite + Tailwind CSS</span>
              </li>
              <li className="flex items-center gap-2">
                <Code className="h-4 w-4" />
                <span>Firebase</span>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-white/10 pt-6 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-gray-400 text-center md:text-left">
            © {currentYear} HAG's QR Scanner. All rights reserved.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>Made with</span>
            <Heart className="h-4 w-4 text-red-500 fill-red-500 animate-pulse" />
            <span>by HAG</span>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;

