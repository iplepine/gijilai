'use client';

import { useState, useEffect, useRef } from 'react';
import { Navbar } from '@/components/layout/Navbar';
import { Button } from '@/components/ui/Button';
import { Icon } from '@/components/ui/Icon';

import { useRouter, useSearchParams } from 'next/navigation';
import { useAppStore } from '@/store/useAppStore';
import { useAuth } from '@/components/auth/AuthProvider';
import { db, ReportData, ChildProfile } from '@/lib/db';
import { TemperamentScorer } from '@/lib/TemperamentScorer';
import { TemperamentClassifier } from '@/lib/TemperamentClassifier';
import { CHILD_QUESTIONS } from '@/data/questions';
import { toPng } from 'html-to-image';
import saveAs from 'file-saver';
import { Suspense } from 'react';

function SharePageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user } = useAuth();
  const { intake, cbqResponses, atqResponses } = useAppStore();
  const [copied, setCopied] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [isSharing, setIsSharing] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  // DB-loaded data
  const [report, setReport] = useState<ReportData | null>(null);
  const [child, setChild] = useState<ChildProfile | null>(null);

  const reportId = searchParams.get('id');

  // Load report from DB if reportId is provided
  useEffect(() => {
    async function loadReport() {
      if (!reportId || !user) return;
      try {
        const reports = await db.getReports(user.id);
        const found = reports.find(r => r.id === reportId);
        if (found) {
          setReport(found);
          if (found.child_id) {
            const children = await db.getChildren(user.id);
            const foundChild = children.find(c => c.id === found.child_id);
            if (foundChild) setChild(foundChild);
          }
        }
      } catch (e) {
        console.error('Failed to load report:', e);
      }
    }
    loadReport();
  }, [reportId, user]);

  // Derive child name and temperament from DB report or local store
  const childName = child?.name || intake.childName || '우리 아이';

  const referralCode = 'GIJILAI-' + (user?.id?.substring(0, 8) || 'FRIEND');

  // Initialize Kakao
  useEffect(() => {
    if (typeof window !== 'undefined' && window.Kakao) {
      if (!window.Kakao.isInitialized()) {
        const key = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || '86e2d8a4369a47468132e08e67f08c5c';
        window.Kakao.init(key);
      }
    }
  }, []);

  // Calculate Temperament from DB report or local store
  const temperamentInfo = (() => {
    // Try DB report first
    if (report?.analysis_json) {
      const analysis = report.analysis_json as any;
      if (analysis.label && analysis.desc) {
        // Get image from classifier using scores if available
        if (analysis.scores) {
          const classified = TemperamentClassifier.analyzeChild(analysis.scores);
          return { label: analysis.label, desc: analysis.desc, image: classified.image };
        }
        return { label: analysis.label, desc: analysis.desc, image: '' };
      }
    }

    // Fallback to local store
    if (!cbqResponses || Object.keys(cbqResponses).length === 0) return null;
    const scores = TemperamentScorer.calculate(CHILD_QUESTIONS, cbqResponses as any);
    const classified = TemperamentClassifier.analyzeChild(scores);
    return { label: classified.label, desc: classified.desc, image: classified.image };
  })();

  const handleCopyCode = async () => {
    const shareUrl = window.location.origin + '?ref=' + referralCode;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleKakaoShare = () => {
    if (!window.Kakao) return;

    const shareUrl = window.location.origin + '?ref=' + referralCode;

    window.Kakao.Share.sendDefault({
      objectType: 'feed',
      content: {
        title: `${childName}는 "${temperamentInfo?.label || '열정 탐험가'}"예요!`,
        description: '과학적인 기질 분석으로 우리 아이의 타고난 빛을 발견해보세요.',
        imageUrl: `${window.location.origin}${temperamentInfo?.image || '/child_type/type_lhl.jpg'}`,
        link: {
          mobileWebUrl: shareUrl,
          webUrl: shareUrl,
        },
      },
      buttons: [
        {
          title: '나도 검사해보기',
          link: {
            mobileWebUrl: shareUrl,
            webUrl: shareUrl,
          },
        },
      ],
    });
  };

  const handleDownloadImage = async () => {
    if (cardRef.current === null) return;
    setIsSharing(true);
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true });
      saveAs(dataUrl, `기질아이-${childName}.png`);
    } catch (err) {
      console.error('Image download failed:', err);
      alert('이미지 저장에 실패했습니다.');
    } finally {
      setIsSharing(false);
    }
  };

  const handleDownloadPdf = async () => {
    if (cardRef.current === null) return;
    setIsPdfGenerating(true);
    try {
      const dataUrl = await toPng(cardRef.current, { cacheBust: true, pixelRatio: 2 });

      const { default: jsPDF } = await import('jspdf');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();

      // Calculate image dimensions to fit A4 width with margins
      const margin = 15;
      const maxWidth = pageWidth - margin * 2;

      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });

      const ratio = img.height / img.width;
      const imgWidth = maxWidth;
      const imgHeight = imgWidth * ratio;

      pdf.addImage(dataUrl, 'PNG', margin, margin, imgWidth, imgHeight);
      pdf.save(`기질아이-${childName}-리포트.pdf`);
    } catch (err) {
      console.error('PDF generation failed:', err);
      alert('PDF 생성에 실패했습니다.');
    } finally {
      setIsPdfGenerating(false);
    }
  };

  // Web Share API for native sharing
  const handleNativeShare = async () => {
    if (!navigator.share) {
      handleCopyCode();
      return;
    }

    try {
      const shareUrl = window.location.origin + '?ref=' + referralCode;
      await navigator.share({
        title: `${childName}의 기질 분석 결과`,
        text: `${childName}는 "${temperamentInfo?.label || '열정 탐험가'}" 기질이에요! 과학적 기질 분석으로 우리 아이를 이해해보세요.`,
        url: shareUrl,
      });
    } catch (err) {
      // User cancelled share - ignore
    }
  };

  return (
    <div className="relative flex min-h-screen w-full flex-col bg-slate-50 dark:bg-slate-900 pb-20">
      <Navbar title="결과 공유하기" showBack onBackClick={() => router.back()} />

      <div className="flex-1 px-6 py-10 max-w-md mx-auto w-full space-y-10">
        {/* Headline */}
        <section className="text-center space-y-2">
          <div className="inline-block px-4 py-1 rounded-full bg-primary/10 text-primary text-[11px] font-bold mb-2">
            SHARE ANALYSIS
          </div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white break-keep leading-tight">
            우리 아이만의 빛나는 기질을<br />가족과 함께 나눠보세요
          </h2>
        </section>

        {/* Temperament Card (Share Preview) */}
        <section className="relative">
          <div ref={cardRef} className="rounded-[2.5rem] overflow-hidden bg-white dark:bg-slate-800 shadow-2xl shadow-primary/10 border border-slate-100 dark:border-slate-700">
            <div
              className="w-full aspect-[4/5] bg-cover bg-center relative"
              style={{
                backgroundImage: `url("${temperamentInfo?.image || '/child_type/type_lhl.jpg'}")`,
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent flex flex-col justify-end p-8 text-white">
                <div className="mb-4">
                  <span className="bg-primary px-3 py-1 rounded-full text-[10px] font-bold tracking-widest uppercase">
                    Temperament Report
                  </span>
                </div>
                <h3 className="text-3xl font-bold mb-2 break-keep">
                  {childName}는<br />
                  <span className="text-primary-light">"{temperamentInfo?.label || '열정 탐험가'}"</span>예요!
                </h3>
                <p className="text-sm opacity-80 leading-relaxed font-medium break-keep">
                  {temperamentInfo?.desc || '호기심이 많고 에너지가 넘치는 탐험가 기질을 가지고 있어요.'}
                </p>
                <div className="mt-6 pt-6 border-t border-white/20 flex items-center gap-2">
                  <img src="/gijilai_icon.png" alt="" className="w-5 h-5 brightness-0 invert opacity-50" />
                  <span className="text-[10px] font-bold tracking-widest uppercase opacity-40">Gijilai Temperament Analysis</span>
                </div>
              </div>
            </div>
          </div>

          {/* Decorative Badge */}
          <div className="absolute -top-4 -right-4 w-20 h-20 bg-white dark:bg-slate-800 rounded-full shadow-xl flex items-center justify-center p-2 rotate-12 border-2 border-primary/20">
            <div className="w-full h-full rounded-full bg-primary flex items-center justify-center text-white text-[10px] font-bold text-center leading-tight">
              기질<br />분석 완료
            </div>
          </div>
        </section>

        {/* Sharing Options */}
        <section className="space-y-4">
          <Button
            variant="kakao"
            size="lg"
            fullWidth
            onClick={handleKakaoShare}
            className="h-16 rounded-2xl flex items-center justify-center gap-3 text-lg bg-[#FEE500] hover:bg-[#FADA0A] text-[#191919] border-none"
          >
            <span className="text-2xl">💬</span> 카카오톡으로 결과 보내기
          </Button>

          <div className="grid grid-cols-3 gap-3">
            <button
              onClick={handleCopyCode}
              className={`h-16 rounded-2xl flex flex-col items-center justify-center gap-1 text-[12px] font-bold border transition-all active:scale-95 ${copied ? 'bg-green-50 text-green-600 border-green-200' : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700'}`}
            >
              <Icon name={copied ? "check" : "link"} size="sm" />
              {copied ? '복사됨' : '링크 복사'}
            </button>
            <button
              onClick={handleDownloadImage}
              disabled={isSharing}
              className="h-16 rounded-2xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1 text-[12px] font-bold transition-all active:scale-95 disabled:opacity-50"
            >
              {isSharing ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Icon name="image" size="sm" />
              )}
              {isSharing ? '저장 중' : '이미지'}
            </button>
            <button
              onClick={handleDownloadPdf}
              disabled={isPdfGenerating}
              className="h-16 rounded-2xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex flex-col items-center justify-center gap-1 text-[12px] font-bold transition-all active:scale-95 disabled:opacity-50"
            >
              {isPdfGenerating ? (
                <div className="w-4 h-4 border-2 border-slate-400 border-t-transparent rounded-full animate-spin"></div>
              ) : (
                <Icon name="picture_as_pdf" size="sm" />
              )}
              {isPdfGenerating ? '생성 중' : 'PDF'}
            </button>
          </div>

          {/* Native Share (mobile) */}
          {'share' in navigator && (
            <button
              onClick={handleNativeShare}
              className="w-full h-14 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center justify-center gap-2 text-[14px] font-bold transition-all active:scale-95"
            >
              <Icon name="share" size="sm" />
              다른 앱으로 공유하기
            </button>
          )}
        </section>

        {/* Benefits Section */}
        <section className="bg-slate-100 dark:bg-slate-800/50 rounded-3xl p-6 border border-slate-200/50">
          <h4 className="text-sm font-bold text-slate-800 dark:text-white mb-3 flex items-center gap-2">
            <span className="text-lg">🎁</span> 친구와 함께 기질아이를 알아봐요
          </h4>
          <p className="text-xs text-slate-500 leading-relaxed break-keep">
            공유된 링크를 통해 친구가 테스트를 완료하면,<br />
            <strong>회원님과 친구 모두에게 990원 할인권</strong>을 드립니다.
          </p>
        </section>
      </div>

      {/* Footer */}
      <div className="px-6 py-8 text-center text-[11px] text-slate-400 font-medium uppercase tracking-[0.2em]">
        designed by gijilai
      </div>
    </div>
  );
}

export default function SharePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin"></div></div>}>
      <SharePageContent />
    </Suspense>
  );
}
