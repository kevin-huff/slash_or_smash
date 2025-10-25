import { useEffect } from 'react';
import { Outlet } from 'react-router-dom';

export function OverlayLayout(): JSX.Element {
  useEffect(() => {
    // Make background transparent for OBS
    const originalBg = document.body.style.backgroundColor;
    const originalRootBg = document.documentElement.style.backgroundColor;
    
    document.body.style.backgroundColor = 'transparent';
    document.documentElement.style.backgroundColor = 'transparent';
    
    return () => {
      document.body.style.backgroundColor = originalBg;
      document.documentElement.style.backgroundColor = originalRootBg;
    };
  }, []);

  return (
    <div className="relative min-h-screen w-full overflow-hidden text-bone-100">
      <Outlet />
    </div>
  );
}
