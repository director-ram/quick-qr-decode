
import React from "react";

/**
 * Animated floating white particles (visual effect).
 */
const FloatingParticles: React.FC = () => (
  <div className="absolute inset-0 pointer-events-none">
    {[...Array(6)].map((_, i) => (
      <div
        key={i}
        className="absolute w-2 h-2 bg-white rounded-full opacity-30 float-animation"
        style={{
          left: `${Math.random() * 100}%`,
          top: `${Math.random() * 100}%`,
          animationDelay: `${Math.random() * 3}s`,
          animationDuration: `${3 + Math.random() * 2}s`,
        }}
      />
    ))}
  </div>
);

export default FloatingParticles;
