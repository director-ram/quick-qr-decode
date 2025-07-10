
import React from "react";

const AnimatedBackground: React.FC = () => (
  <div className="absolute inset-0 bg-gradient-to-br from-purple-900 via-blue-800 to-purple-800">
    <div className="absolute top-20 left-20 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-40 float-animation"></div>
    <div className="absolute top-40 right-20 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl opacity-40 float-animation" style={{ animationDelay: "2s" }}></div>
    <div className="absolute -bottom-8 left-40 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-40 float-animation" style={{ animationDelay: "4s" }}></div>
    <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent"></div>
  </div>
);

export default AnimatedBackground;
