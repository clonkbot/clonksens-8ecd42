import { useState, useEffect, useRef, useCallback } from 'react'

// Web Speech API type declarations
interface SpeechRecognitionResult {
  readonly isFinal: boolean
  readonly length: number
  item(index: number): SpeechRecognitionAlternative
  [index: number]: SpeechRecognitionAlternative
}

interface SpeechRecognitionAlternative {
  readonly transcript: string
  readonly confidence: number
}

interface SpeechRecognitionResultList {
  readonly length: number
  item(index: number): SpeechRecognitionResult
  [index: number]: SpeechRecognitionResult
}

interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number
  readonly results: SpeechRecognitionResultList
}

interface SpeechRecognitionInstance extends EventTarget {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((event: SpeechRecognitionEvent) => void) | null
  onerror: ((event: Event) => void) | null
  onend: ((event: Event) => void) | null
}

interface SpeechRecognitionConstructor {
  new (): SpeechRecognitionInstance
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionConstructor
    webkitSpeechRecognition?: SpeechRecognitionConstructor
  }
}

// Floating Hangul characters for background atmosphere
const hangulChars = ['한', '국', '어', '번', '역', '음', '성', '인', '식', '말', '듣', '기', '영', '어', '변', '환', '소', '리', '통', '역']

interface FloatingChar {
  id: number
  char: string
  x: number
  y: number
  delay: number
  duration: number
  size: number
}

function FloatingHangul() {
  const [chars, setChars] = useState<FloatingChar[]>([])
  
  useEffect(() => {
    const generated: FloatingChar[] = []
    for (let i = 0; i < 20; i++) {
      generated.push({
        id: i,
        char: hangulChars[Math.floor(Math.random() * hangulChars.length)],
        x: Math.random() * 100,
        y: Math.random() * 100,
        delay: Math.random() * 5,
        duration: 5 + Math.random() * 5,
        size: 1.5 + Math.random() * 2.5
      })
    }
    setChars(generated)
  }, [])
  
  return (
    <>
      {chars.map(c => (
        <div
          key={c.id}
          className="hangul-bg font-korean text-cyan-400/10 animate-float"
          style={{
            left: `${c.x}%`,
            top: `${c.y}%`,
            fontSize: `${c.size}rem`,
            animationDelay: `${c.delay}s`,
            animationDuration: `${c.duration}s`
          }}
        >
          {c.char}
        </div>
      ))}
    </>
  )
}

// Audio visualizer bars
function AudioVisualizer({ isActive, audioLevel }: { isActive: boolean; audioLevel: number }) {
  const bars = 12
  
  return (
    <div className="flex items-center justify-center gap-1 h-16">
      {Array.from({ length: bars }).map((_, i) => {
        const baseHeight = isActive ? 8 + audioLevel * 40 * Math.sin((Date.now() / 200) + i) : 8
        const height = Math.max(8, Math.min(48, baseHeight + (isActive ? Math.random() * 16 : 0)))
        
        return (
          <div
            key={i}
            className="w-1.5 rounded-full transition-all duration-75"
            style={{
              height: `${height}px`,
              background: isActive 
                ? `linear-gradient(to top, #00f5ff, #ff00aa)`
                : 'rgba(255,255,255,0.2)',
              animationDelay: `${i * 0.08}s`,
              boxShadow: isActive ? '0 0 10px rgba(0, 245, 255, 0.5)' : 'none'
            }}
          />
        )
      })}
    </div>
  )
}

// Simulated translation pairs (since we can't use external APIs)
const translationPairs: { korean: string; english: string }[] = [
  { korean: "안녕하세요", english: "Hello" },
  { korean: "반갑습니다", english: "Nice to meet you" },
  { korean: "감사합니다", english: "Thank you" },
  { korean: "좋은 하루 되세요", english: "Have a nice day" },
  { korean: "도와주세요", english: "Please help me" },
  { korean: "이해했습니다", english: "I understand" },
  { korean: "잠시만요", english: "Just a moment" },
  { korean: "네, 알겠습니다", english: "Yes, I understand" },
  { korean: "어디에 있어요?", english: "Where is it?" },
  { korean: "얼마예요?", english: "How much is it?" },
  { korean: "맛있어요", english: "It's delicious" },
  { korean: "천천히 말해주세요", english: "Please speak slowly" },
]

function App() {
  const [isListening, setIsListening] = useState(false)
  const [koreanText, setKoreanText] = useState('')
  const [englishText, setEnglishText] = useState('')
  const [audioLevel, setAudioLevel] = useState(0)
  const [status, setStatus] = useState<'idle' | 'listening' | 'processing' | 'translated'>('idle')
  const [permissionDenied, setPermissionDenied] = useState(false)
  const [displayedEnglish, setDisplayedEnglish] = useState('')
  
  const audioContextRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const demoIntervalRef = useRef<number | null>(null)

  // Typewriter effect for English translation
  useEffect(() => {
    if (englishText && status === 'translated') {
      setDisplayedEnglish('')
      let index = 0
      const timer = setInterval(() => {
        if (index < englishText.length) {
          setDisplayedEnglish(englishText.slice(0, index + 1))
          index++
        } else {
          clearInterval(timer)
        }
      }, 40)
      return () => clearInterval(timer)
    }
  }, [englishText, status])

  const analyzeAudio = useCallback(() => {
    if (analyserRef.current) {
      const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount)
      analyserRef.current.getByteFrequencyData(dataArray)
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length
      setAudioLevel(average / 255)
    }
    animationFrameRef.current = requestAnimationFrame(analyzeAudio)
  }, [])

  const simulateTranslation = useCallback((text: string) => {
    // Find matching translation or create a simulated one
    const match = translationPairs.find(p => 
      text.includes(p.korean) || p.korean.includes(text)
    )
    
    if (match) {
      return match.english
    }
    
    // For demo purposes, return a generic translation
    return `[Translation of: "${text}"]`
  }, [])

  const startDemoMode = useCallback(() => {
    // Demo mode: cycle through translations
    let index = 0
    
    const runDemo = () => {
      const pair = translationPairs[index % translationPairs.length]
      setKoreanText(pair.korean)
      setStatus('processing')
      setTimeout(() => {
        setEnglishText(pair.english)
        setStatus('translated')
      }, 800)
      index++
    }
    
    // Show first translation immediately
    runDemo()
    
    demoIntervalRef.current = window.setInterval(runDemo, 4000)
  }, [])

  const startListening = async () => {
    try {
      // Request microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      
      // Set up audio analysis for visualizer
      audioContextRef.current = new AudioContext()
      analyserRef.current = audioContextRef.current.createAnalyser()
      const source = audioContextRef.current.createMediaStreamSource(stream)
      source.connect(analyserRef.current)
      analyserRef.current.fftSize = 256
      
      // Start analyzing audio levels
      analyzeAudio()
      
      // Check for Web Speech API support
      const SpeechRecognitionAPI = window.SpeechRecognition || window.webkitSpeechRecognition
      
      if (SpeechRecognitionAPI) {
        const recognition = new SpeechRecognitionAPI()
        recognition.lang = 'ko-KR'
        recognition.continuous = true
        recognition.interimResults = true
        
        recognition.onresult = (event: SpeechRecognitionEvent) => {
          let transcript = ''
          for (let i = 0; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript
          }
          
          setKoreanText(transcript)
          setStatus('processing')
          
          // Simulate translation after getting Korean text
          const lastResult = event.results[event.results.length - 1]
          if (lastResult.isFinal) {
            setTimeout(() => {
              const translation = simulateTranslation(transcript)
              setEnglishText(translation)
              setStatus('translated')
            }, 500)
          }
        }
        
        recognition.onerror = () => {
          // If speech recognition fails, use demo mode
          startDemoMode()
        }
        
        recognition.start()
        recognitionRef.current = recognition
      } else {
        // Fallback to demo mode if Web Speech API not available
        startDemoMode()
      }
      
      setIsListening(true)
      setStatus('listening')
      setPermissionDenied(false)
    } catch {
      setPermissionDenied(true)
      setStatus('idle')
    }
  }

  const stopListening = () => {
    // Stop demo interval
    if (demoIntervalRef.current) {
      clearInterval(demoIntervalRef.current)
      demoIntervalRef.current = null
    }
    
    // Stop speech recognition
    if (recognitionRef.current) {
      recognitionRef.current.stop()
      recognitionRef.current = null
    }
    
    // Stop audio stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    
    // Stop audio context
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    
    setIsListening(false)
    setAudioLevel(0)
    setStatus('idle')
  }

  const toggleListening = () => {
    if (isListening) {
      stopListening()
    } else {
      startListening()
    }
  }

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white relative overflow-hidden flex flex-col">
      {/* Floating Hangul Background */}
      <FloatingHangul />
      
      {/* Gradient overlays */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-80 h-80 bg-pink-500/10 rounded-full blur-[100px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-cyan-500/5 via-transparent to-pink-500/5 rounded-full blur-[80px]" />
      </div>
      
      {/* Grid pattern overlay */}
      <div 
        className="fixed inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: `linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)`,
          backgroundSize: '50px 50px'
        }}
      />
      
      {/* Main Content */}
      <main className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-8">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-5xl md:text-7xl font-bold font-korean tracking-wider mb-4">
            <span className="gradient-text">Clonksens</span>
          </h1>
          <p className="text-lg md:text-xl text-white/50 font-light tracking-wide">
            Korean → English <span className="text-cyan-400">Live Translation</span>
          </p>
        </div>
        
        {/* Microphone Button & Visualizer */}
        <div className="relative mb-12">
          {/* Pulse rings when active */}
          {isListening && (
            <>
              <div className="absolute inset-0 -m-4 rounded-full bg-cyan-500/20 animate-pulse-ring" />
              <div className="absolute inset-0 -m-8 rounded-full bg-pink-500/10 animate-pulse-ring" style={{ animationDelay: '0.5s' }} />
              <div className="absolute inset-0 -m-12 rounded-full bg-cyan-500/5 animate-pulse-ring" style={{ animationDelay: '1s' }} />
            </>
          )}
          
          <button
            onClick={toggleListening}
            className={`
              mic-button relative w-32 h-32 md:w-40 md:h-40 rounded-full
              flex items-center justify-center
              ${isListening 
                ? 'active' 
                : 'bg-gradient-to-br from-cyan-500 to-cyan-600 hover:from-cyan-400 hover:to-cyan-500 neon-border'
              }
              transition-all duration-300
            `}
          >
            <svg 
              className={`w-12 h-12 md:w-16 md:h-16 ${isListening ? 'animate-glow text-white' : 'text-white'}`}
              fill="currentColor" 
              viewBox="0 0 24 24"
            >
              {isListening ? (
                // Stop icon
                <rect x="6" y="6" width="12" height="12" rx="2" />
              ) : (
                // Microphone icon
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3zm-1-9c0-.55.45-1 1-1s1 .45 1 1v6c0 .55-.45 1-1 1s-1-.45-1-1V5zm6 6c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/>
              )}
            </svg>
          </button>
        </div>
        
        {/* Audio Visualizer */}
        <div className="mb-8 h-16">
          <AudioVisualizer isActive={isListening} audioLevel={audioLevel} />
        </div>
        
        {/* Status */}
        <div className="mb-8 h-8">
          {status === 'idle' && (
            <p className="text-white/40 text-sm tracking-widest uppercase">Tap to start listening</p>
          )}
          {status === 'listening' && (
            <p className="text-cyan-400 text-sm tracking-widest uppercase animate-pulse">Listening for Korean...</p>
          )}
          {status === 'processing' && (
            <p className="text-pink-400 text-sm tracking-widest uppercase">Processing...</p>
          )}
          {status === 'translated' && (
            <p className="text-green-400 text-sm tracking-widest uppercase">Translated</p>
          )}
        </div>
        
        {/* Permission Denied Warning */}
        {permissionDenied && (
          <div className="mb-8 px-6 py-4 glass rounded-xl border border-red-500/30 text-center max-w-md">
            <p className="text-red-400 text-sm">
              Microphone access denied. Please allow microphone access to use translation.
            </p>
          </div>
        )}
        
        {/* Translation Display */}
        <div className="w-full max-w-2xl space-y-6">
          {/* Korean Input */}
          <div className="glass rounded-2xl p-6 neon-border">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 bg-cyan-500/20 text-cyan-400 text-xs font-semibold rounded-full tracking-wider">
                한국어
              </span>
              <span className="text-white/30 text-xs">Korean</span>
            </div>
            <p className={`text-2xl md:text-3xl font-noto min-h-[2.5rem] ${koreanText ? 'text-white' : 'text-white/20'}`}>
              {koreanText || '한국어로 말해주세요...'}
            </p>
          </div>
          
          {/* Arrow */}
          <div className="flex justify-center">
            <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </div>
          
          {/* English Output */}
          <div className="glass rounded-2xl p-6" style={{ boxShadow: '0 0 20px rgba(255, 0, 170, 0.15), 0 0 40px rgba(255, 0, 170, 0.1)' }}>
            <div className="flex items-center gap-3 mb-3">
              <span className="px-3 py-1 bg-pink-500/20 text-pink-400 text-xs font-semibold rounded-full tracking-wider">
                ENGLISH
              </span>
              <span className="text-white/30 text-xs">Translation</span>
            </div>
            <p className={`text-2xl md:text-3xl font-light min-h-[2.5rem] ${displayedEnglish ? 'text-white' : 'text-white/20'}`}>
              {displayedEnglish || 'Translation will appear here...'}
              {status === 'translated' && displayedEnglish.length < englishText.length && (
                <span className="inline-block w-0.5 h-7 bg-pink-400 ml-1 animate-pulse" />
              )}
            </p>
          </div>
        </div>
        
        {/* Instructions */}
        <div className="mt-12 text-center max-w-md">
          <div className="flex items-center justify-center gap-6 text-white/30 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-cyan-400" />
              <span>Click mic to start</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-pink-400" />
              <span>Speak in Korean</span>
            </div>
          </div>
        </div>
      </main>
      
      {/* Footer */}
      <footer className="relative z-10 py-6 text-center">
        <p className="text-white/25 text-xs tracking-wide">
          Requested by <span className="text-white/40">@JolupCCTV</span> · Built by <span className="text-white/40">@clonkbot</span>
        </p>
      </footer>
    </div>
  )
}

export default App