import React from "react";
import logoImg from "../assets/logo.jpg";

export default function DRemindULogo({
  size = "md",
  showText = true,
  subtitle = false,
  className = "",
  textClassName = "",
  onClick,
}) {
  const sizeMap = {
    sm: {
      img: "w-7 h-7 rounded-lg",
      text: "text-base font-extrabold",
      badge: "shadow-xs",
    },
    md: {
      img: "w-9 h-9 rounded-xl",
      text: "text-lg sm:text-xl font-extrabold",
      badge: "shadow-md shadow-yellow-500/15",
    },
    lg: {
      img: "w-12 h-12 sm:w-14 sm:h-14 rounded-2xl",
      text: "text-2xl sm:text-3xl font-black",
      badge: "shadow-lg shadow-yellow-500/20",
    },
    xl: {
      img: "w-16 h-16 sm:w-20 sm:h-20 rounded-2xl",
      text: "text-3xl sm:text-4xl font-black",
      badge: "shadow-xl shadow-yellow-500/25",
    },
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div
      onClick={onClick}
      className={`inline-flex items-center gap-3 select-none ${
        onClick ? "cursor-pointer" : ""
      } ${className}`}
    >
      {/* 3D Realistic Logo Icon */}
      <div
        className={`relative flex-shrink-0 p-0.5 rounded-[13px] bg-gradient-to-br from-yellow-400/40 via-yellow-600/20 to-slate-800/80 border border-yellow-400/40 ${currentSize.badge} group transition-transform duration-200 hover:scale-105`}
      >
        <img
          src={logoImg}
          alt="DRemindU 3D Medical Logo"
          className={`${currentSize.img} object-cover rounded-[11px] ring-1 ring-yellow-400/30`}
        />
        {/* Subtle realistic lighting gleam overlay */}
        <div className="absolute inset-0 rounded-[11px] bg-gradient-to-t from-transparent via-transparent to-white/15 pointer-events-none" />
      </div>

      {/* Brand Name Typography */}
      {showText && (
        <div className={`flex flex-col leading-none ${textClassName}`}>
          <span
            className={`${currentSize.text} tracking-tight text-white flex items-baseline`}
          >
            DRemind
            <span className="text-yellow-400 drop-shadow-[0_0_12px_rgba(250,204,21,0.4)]">
              U
            </span>
          </span>
          {subtitle && (
            <span className="text-[10px] font-semibold text-slate-400 tracking-widest uppercase mt-0.5 hidden sm:block">
              Smart Medication Platform
            </span>
          )}
        </div>
      )}
    </div>
  );
}
