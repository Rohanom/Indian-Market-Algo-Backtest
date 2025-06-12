declare module 'truedata-nodejs' {
  export const historical: {
    auth: (username: string, password: string) => any;
    getBarData: (symbol: string, from: string, to: string, interval: string) => Promise<any>;
  };
  
  export const rtConnect: (...args: any[]) => void;
  export const rtDisconnect: (...args: any[]) => void;
  export const rtSubscribe: (...args: any[]) => void;
  export const rtUnsubscribe: (...args: any[]) => void;
  export const rtFeed: any;
  export const isSocketConnected: () => boolean;
} 