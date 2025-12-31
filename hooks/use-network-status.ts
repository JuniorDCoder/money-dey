import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

export interface NetworkState {
  isOnline: boolean;
  isWifiConnected: boolean;
  isCellularConnected: boolean;
  connectionType: 'wifi' | 'cellular' | 'none' | 'unknown';
}

export function useNetworkStatus() {
  const [networkState, setNetworkState] = useState<NetworkState>({
    isOnline: true,
    isWifiConnected: false,
    isCellularConnected: false,
    connectionType: 'unknown',
  });

  useEffect(() => {
    // Check current state on mount
    const checkInitialState = async () => {
      try {
        const state = await NetInfo.fetch();
        updateNetworkState(state);
      } catch (e) {
        console.warn('Failed to fetch initial network state', e);
      }
    };

    checkInitialState();

    // Subscribe to network state changes
    const unsubscribe = NetInfo.addEventListener((state) => {
      updateNetworkState(state);
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const updateNetworkState = (state: any) => {
    const isOnline = state.isConnected && state.isInternetReachable !== false;
    const connectionType = state.type || 'unknown';
    const isWifi = connectionType === 'wifi';
    const isCellular = connectionType === 'cellular';

    setNetworkState({
      isOnline,
      isWifiConnected: isWifi,
      isCellularConnected: isCellular,
      connectionType,
    });
  };

  return networkState;
}
