
import React from "react";

/**
 * Animated floating white particles (visual effect).
 */
const FloatingParticles: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden">
    {[...Array(12)].map((_, i) => (
      <div
        key={i}
        className="absolute w-3 h-3 bg-white rounded-full opacity-60 float-animation"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 5}s`,
          animationDuration: `${4 + Math.random() * 3}s`,
        }}
      />
    ))}
    {[...Array(8)].map((_, i) => (
      <div
        key={`star-${i}`}
        className="absolute w-1 h-1 bg-yellow-300 rounded-full opacity-80 float-animation"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 4}s`,
          animationDuration: `${3 + Math.random() * 2}s`,
        }}
      />
    ))}
  </div>
);

export default FloatingParticles;
