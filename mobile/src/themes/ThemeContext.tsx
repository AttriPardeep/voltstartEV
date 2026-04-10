// src/theme/ThemeContext.tsx
import React, { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useColorScheme } from 'react-native';
import * as Brightness from 'expo-brightness';
import { ThemeColors, ThemeMode, getTheme, themes } from './theme';

interface ThemeContextType {
  theme: ThemeColors;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
  outdoorMode: boolean;
  toggleOutdoorMode: () => void;
  brightnessLevel: number;
  isAutoDetecting: boolean;
  setIsAutoDetecting: (value: boolean) => void;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeMode] = useState<ThemeMode>('dark');
  const [outdoorMode, setOutdoorMode] = useState(false);
  const [brightnessLevel, setBrightnessLevel] = useState(1);
  const [isAutoDetecting, setIsAutoDetecting] = useState(true);
  
  // Track manual toggle to prevent auto-override
  const manualToggleRef = useRef(false);
  const lastManualToggleTime = useRef<number>(0);
  const MANUAL_TOGGLE_COOLDOWN = 30000; // 30 seconds cooldown after manual toggle

  useEffect(() => {
    if (!isAutoDetecting) return;
    
    // Skip auto-detect if user manually toggled recently
    const timeSinceManualToggle = Date.now() - lastManualToggleTime.current;
    if (manualToggleRef.current && timeSinceManualToggle < MANUAL_TOGGLE_COOLDOWN) {
      return;
    }
    
    let interval: NodeJS.Timeout;
    
    const checkBrightness = async () => {
      try {
        const { status } = await Brightness.requestPermissionsAsync();
        if (status === 'granted') {
          const brightness = await Brightness.getBrightnessAsync();
          setBrightnessLevel(brightness);
          
          // Only auto-adjust if user hasn't manually toggled recently
          if (!manualToggleRef.current || timeSinceManualToggle >= MANUAL_TOGGLE_COOLDOWN) {
            if (brightness > 0.85) {
              setOutdoorMode(true);
            } else if (brightness < 0.7) {
              setOutdoorMode(false);
            }
          }
        }
      } catch (err) {
        console.log('Brightness permission denied or unavailable');
      }
    };

    checkBrightness();
    interval = setInterval(checkBrightness, 15000);
    
    return () => {
      if (interval) clearInterval(interval);
    };
    //  Remove outdoorMode from deps to prevent re-run on toggle
  }, [isAutoDetecting]); // ← Only depend on isAutoDetecting

  // Determine active theme
  const isDark = themeMode === 'dark' || (themeMode === 'auto' && systemColorScheme === 'dark');
  const theme = outdoorMode ? themes.light : getTheme(themeMode, isDark);

  //  Toggle function that respects manual control
  const toggleOutdoorMode = () => {
    manualToggleRef.current = true;
    lastManualToggleTime.current = Date.now();
    setOutdoorMode(prev => !prev);
    
    // Reset manual flag after cooldown (optional: or keep until next auto-detect cycle)
    setTimeout(() => {
      // Only reset if auto-detect is still enabled
      if (isAutoDetecting) {
        manualToggleRef.current = false;
      }
    }, MANUAL_TOGGLE_COOLDOWN);
  };

  return (
    <ThemeContext.Provider
      value={{
        theme,
        themeMode,
        setThemeMode,
        outdoorMode,
        toggleOutdoorMode,
        brightnessLevel,
        isAutoDetecting,
        setIsAutoDetecting,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}