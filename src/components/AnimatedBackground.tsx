
import React from "react";

const AnimatedBackground: React.FC = () => (
  <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-blue-50 to-purple-50">
    <div className="absolute top-20 left-20 w-72 h-72 bg-purple-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 float-animation"></div>
    <div className="absolute top-40 right-20 w-72 h-72 bg-yellow-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 float-animation" style={{ animationDelay: "2s" }}></div>
    <div className="absolute -bottom-8 left-40 w-72 h-72 bg-pink-300 rounded-full mix-blend-multiply filter blur-xl opacity-70 float-animation" style={{ animationDelay: "4s" }}></div>
  </div>
);

export default AnimatedBackground;
