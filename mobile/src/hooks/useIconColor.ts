// src/hooks/useIconColor.ts
import { useTheme } from '../themes/ThemeContext'; 
import { IconColor } from '../components/icons';

export const useIconColor = (variant: keyof typeof IconColor) => {
  const { theme } = useTheme();
  // Map theme mode to actual colors
  const colorMap = theme === 'dark' 
    ? { primary: '#67e8f9', success: '#34d399', warning: '#fbbf24', error: '#f87171', info: '#60a5fa', muted: '#9ca3af', text: '#f3f4f6' }
    : IconColor;
    
  return colorMap[variant];
};

// Usage in components:
const primaryColor = useIconColor('primary');
<AppIcon.Zap color={primaryColor} />