interface Window {
    Kakao?: {
        init: (appKey: string) => void;
        isInitialized: () => boolean;
        Share: {
            sendScrap: (payload: {
                requestUrl: string;
                templateId?: number;
                templateArgs?: Record<string, string>;
                serverCallbackArgs?: Record<string, string>;
            }) => void;
        };
    };
}
