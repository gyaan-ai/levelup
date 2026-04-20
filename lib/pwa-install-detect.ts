export type PwaInstallContextInfo = {
  isStandalone: boolean;
  isIOS: boolean;
  isAndroid: boolean;
  isMobile: boolean;
  /** Facebook / Instagram / etc. embedded browser — Add to Home Screen usually fails until user opens real Safari */
  isIOSInAppBrowser: boolean;
  isIOSSafari: boolean;
  isIOSOtherBrowser: boolean;
  environmentLabel: string;
};

/** Match common iOS in-app WebViews (not the standalone Safari UI). */
function isLikelyIOSInAppBrowser(ua: string): boolean {
  return (
    /Instagram/i.test(ua) ||
    /FBAN|FBAV|FB_IAB|FBIOS/i.test(ua) ||
    /Line\//i.test(ua) ||
    /LinkedInApp/i.test(ua) ||
    /Snapchat/i.test(ua) ||
    /TikTok/i.test(ua) ||
    /Twitter/i.test(ua) ||
    /Pinterest/i.test(ua) ||
    /Reddit/i.test(ua) ||
    /KAKAOTALK/i.test(ua) ||
    /MicroMessenger/i.test(ua)
  );
}

export function detectPwaInstallContext(): PwaInstallContextInfo {
  if (typeof window === 'undefined') {
    return {
      isStandalone: false,
      isIOS: false,
      isAndroid: false,
      isMobile: false,
      isIOSInAppBrowser: false,
      isIOSSafari: false,
      isIOSOtherBrowser: false,
      environmentLabel: '',
    };
  }

  const ua = navigator.userAgent;
  const isStandalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as { standalone?: boolean }).standalone === true;

  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  const isAndroid = /Android/i.test(ua);
  const isMobile = isIOS || isAndroid || /Mobile|webOS|BlackBerry/i.test(ua);

  const isIOSInAppBrowser = isIOS && isLikelyIOSInAppBrowser(ua);

  const isIOSSafari =
    isIOS &&
    !isIOSInAppBrowser &&
    /Safari/i.test(ua) &&
    !/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|DuckDuckGo/i.test(ua);

  const isIOSOtherBrowser = isIOS && !isIOSSafari && !isIOSInAppBrowser;

  let environmentLabel = 'This device';
  if (isIOSInAppBrowser) {
    environmentLabel = 'In-app browser on iPhone or iPad';
  } else if (isIOSSafari) {
    environmentLabel = 'Safari on iPhone or iPad';
  } else if (isIOSOtherBrowser) {
    if (/CriOS/i.test(ua)) environmentLabel = 'Chrome on iPhone or iPad';
    else if (/FxiOS/i.test(ua)) environmentLabel = 'Firefox on iPhone or iPad';
    else if (/EdgiOS/i.test(ua)) environmentLabel = 'Edge on iPhone or iPad';
    else environmentLabel = 'This browser on iPhone or iPad';
  } else if (isAndroid) {
    if (/Chrome/i.test(ua) && !/EdgA/i.test(ua)) environmentLabel = 'Chrome on Android';
    else if (/EdgA/i.test(ua)) environmentLabel = 'Edge on Android';
    else if (/Firefox/i.test(ua)) environmentLabel = 'Firefox on Android';
    else environmentLabel = 'Browser on Android';
  } else if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) {
    environmentLabel = 'Chrome on this computer';
  } else if (/Edg/i.test(ua)) {
    environmentLabel = 'Edge on this computer';
  }

  return {
    isStandalone,
    isIOS,
    isAndroid,
    isMobile,
    isIOSInAppBrowser,
    isIOSSafari,
    isIOSOtherBrowser,
    environmentLabel,
  };
}
