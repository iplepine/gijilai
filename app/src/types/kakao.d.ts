interface Window {
    Kakao?: {
        init: (appKey: string) => void;
        isInitialized: () => boolean;
        Share: {
            sendDefault: (payload: {
                objectType: 'feed';
                content: {
                    title: string;
                    description: string;
                    imageUrl: string;
                    link: {
                        mobileWebUrl: string;
                        webUrl: string;
                    };
                };
                buttons: Array<{
                    title: string;
                    link: {
                        mobileWebUrl: string;
                        webUrl: string;
                    };
                }>;
            }) => void;
        };
    };
}
