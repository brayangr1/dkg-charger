import { useEffect, useRef } from 'react';

type UseChargerWebSocketProps = {
  token: string;
  chargerIds: number[];
  onMessage: (data: any) => void;
};

export function useChargerWebSocket({ token, chargerIds, onMessage }: UseChargerWebSocketProps) {
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;
    ws.current = new window.WebSocket(`ws://localhost:5000?token=${token}`);

    ws.current.onopen = () => {
      chargerIds.forEach((chargerId) => {
        ws.current?.send(JSON.stringify({ type: 'subscribe', chargerId }));
      });
    };

    ws.current.onmessage = (event: MessageEvent) => {
      const data = JSON.parse(event.data);
      onMessage(data);
    };

    ws.current.onerror = (err) => {
      console.error('WebSocket error:', err);
    };

    return () => {
      ws.current?.close();
    };
  }, [token, chargerIds, onMessage]);
} 