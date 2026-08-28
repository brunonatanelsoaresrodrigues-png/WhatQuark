import React from "react";
export default function BrandMark({
  className
}) {
  return <svg className={className} viewBox="0 0 32 32" fill="none" aria-hidden="true">
      <rect x="5" y="5" width="18" height="18" rx="5" stroke="currentColor" strokeWidth="1.6" />
      <path d="M12 10h10a5 5 0 0 1 5 5v12l-5-3H12a3 3 0 0 1-3-3V13a3 3 0 0 1 3-3Z" fill="currentColor" fillOpacity=".13" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      <path d="M14 15h8m-8 4h5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>;
}
