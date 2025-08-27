


type RedisSubscriber = {
  pSubscribe: (pattern: string, listener: (message: string, channel: string) => void | Promise<void>) => Promise<void>;
  pUnsubscribe?: (pattern?: string) => Promise<void>;
  unsubscribe?: (pattern?: string) => Promise<void>;
};