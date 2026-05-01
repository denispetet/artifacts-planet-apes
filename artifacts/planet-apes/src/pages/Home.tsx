import { useState, useRef, useCallback, useEffect } from "react";
import { ethers } from "ethers";
import { useToast } from "@/hooks/useToast";
import { useWallet } from "@/hooks/useWallet";
import {
  USDM_ADDRESS,
  SKIN_CONTRACT_ADDR,
  ERC20_ABI,
  SKIN_ABI,
  SKIN_IDS,
  getBrowserName,
  getInstallLinks,
  DetectedWallet,
} from "@/lib/wallet";

const SKINS = [
  { name: "King Ape",    img: "https://i.imgur.com/YestlX1.jpg", rarity: "RARE",      rarityBg: "#FFD700", rarityTxt: "#000", boost: "1.5x BOOST (+50%)",   price: 5,  boostVal: 1.5, border: "rgba(250,204,21,0.4)", imgBorder: "#FFD700" },
  { name: "Banana God",  img: "https://i.imgur.com/eyQoioN.jpg", rarity: "EPIC",      rarityBg: "#a855f7", rarityTxt: "#fff", boost: "2.0x BOOST (DOUBLE)", price: 10, boostVal: 2.0, border: "rgba(250,204,21,0.4)", imgBorder: "#FFD700" },
  { name: "Degen Ape",   img: "https://i.imgur.com/7VFGhCb.jpg", rarity: "LEGENDARY", rarityBg: "#ef4444", rarityTxt: "#fff", boost: "2.5x BOOST (+150%)",  price: 20, boostVal: 2.5, border: "rgba(239,68,68,0.4)",  imgBorder: "#ef4444" },
  { name: "Jungle Chad", img: "https://i.imgur.com/4rUjNtO.jpg", rarity: "RARE",      rarityBg: "#3b82f6", rarityTxt: "#fff", boost: "3.0x BOOST (TRIPLE)", price: 40, boostVal: 3.0, border: "rgba(59,130,246,0.4)", imgBorder: "#3b82f6" },
];

const FAQS = [
  { q: "🍌 What is Planet Apes?", a: "Planet Apes ($APES) is the most based meme coin on MegaETH. Take bananas, climb the leaderboard, and rule the jungle with your fellow apes." },
  { q: "🎮 How do I play Take Banana?", a: "Simply click anywhere on the game area to collect bananas. The more you click, the higher your score. Reach higher levels and submit your score to the leaderboard!" },
  { q: "💎 What is the 3x Holder Boost?", a: "If you hold 10,000,000 or more $APES tokens, connect your wallet and verify your balance to get a permanent 3x multiplier on all bananas collected." },
  { q: "🏆 How do I win the $150 prize?", a: "Play the Take Banana game, achieve the highest score, and submit it to the leaderboard via wallet signature. Top 3 scores each week split $150 in prizes." },
  { q: "👕 What are Ape Skins?", a: "Ape Skins are cosmetic NFTs on MegaETH that also give score multipliers: King Ape (1.5x), Banana God (2x), Degen Ape (2.5x), Jungle Chad (3x). Prices: 5, 10, 20, 40 USDM." },
  { q: "🔐 Why do I need to sign with my wallet?", a: "Wallet signing proves you actually own the address associated with your score. It's gasless (no ETH needed) and prevents cheating on the leaderboard." },
  { q: "🔗 What blockchain is $APES on?", a: "Planet Apes ($APES) is live on MegaETH Mainnet (Chain ID: 4326), the fastest Ethereum Layer 2 blockchain with near-instant transactions." },
];

const FALLBACK_LB = [
  { name: "HarambeReborn", score: 12450 },
  { name: "BananaSlayer",  score: 9820  },
  { name: "JungleChad",    score: 8740  },
  { name: "MoonApe420",    score: 7650  },
  { name: "PeelMaster",    score: 6890  },
];
const MEDALS = ["👑", "🥈", "🥉"];

interface LeaderboardEntry { name: string; score: number; }

function escHtml(s: string) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function smoothScroll(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth" });
}

export default function Home() {
  const { showToast } = useToast();
  const { wallet, connect, getWallets } = useWallet(showToast);

  const [walletModal, setWalletModal] = useState(false);
  const [holderModal, setHolderModal] = useState(false);
  const [submitModal, setSubmitModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitName, setSubmitName] = useState("");
  const [openFaqIdx, setOpenFaqIdx] = useState<number | null>(null);

  const [score, setScore] = useState(0);
  const [level, setLevel] = useState(1);
  const [bananasNeeded, setBananasNeeded] = useState(10000);
  const [personalBest, setPersonalBest] = useState(0);
  const [holderBoost, setHolderBoost] = useState(false);
  const [equippedSkin, setEquippedSkin] = useState(() => localStorage.getItem("planetApesCurrentSkin") || "");
  const [skinBoost, setSkinBoost] = useState(() => {
    const saved = localStorage.getItem("planetApesCurrentSkin");
    if (saved) { const s = SKINS.find(x => x.name === saved); if (s) return s.boostVal; }
    return 1.0;
  });
  const [ownedSkins, setOwnedSkins] = useState<string[]>(() => {
    try { return JSON.parse(localStorage.getItem("planetApesOwnedSkins") || "[]"); } catch { return []; }
  });
  const [treasury, setTreasury] = useState(1245);
  const [apeImg, setApeImg] = useState("https://i.imgur.com/KlM5HWE.jpg");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>(FALLBACK_LB);
  const [particles, setParticles] = useState<{ id: number; x: number; y: number; type: string }[]>([]);
  const [levelMsg, setLevelMsg] = useState("");
  const [showLevelMsg, setShowLevelMsg] = useState(false);
  const [showInstruction, setShowInstruction] = useState(true);
  const [showPowerup, setShowPowerup] = useState(false);

  const [musicOn, setMusicOn] = useState(true);
  const musicStartedRef = useRef(false);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const musicControlRef = useRef<{ stop: () => void; setVolume: (v: number) => void } | null>(null);

  const scoreRef = useRef(0);
  const levelRef = useRef(1);
  const bananasNeededRef = useRef(10000);
  const personalBestRef = useRef(0);
  const holderBoostRef = useRef(false);
  const skinBoostRef = useRef(1.0);
  const comboCountRef = useRef(0);
  const lastClickRef = useRef(0);
  const particleIdRef = useRef(0);
  const apeImgRef = useRef("https://i.imgur.com/KlM5HWE.jpg");
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const apeImgElRef = useRef<HTMLImageElement>(null);

  useEffect(() => { holderBoostRef.current = holderBoost; }, [holderBoost]);
  useEffect(() => { skinBoostRef.current = skinBoost; }, [skinBoost]);
  useEffect(() => { apeImgRef.current = apeImg; }, [apeImg]);

  function animateApe(scale: number) {
    if (apeImgElRef.current) {
      apeImgElRef.current.style.transform = `scale(${scale})`;
      setTimeout(() => { if (apeImgElRef.current) apeImgElRef.current.style.transform = "scale(1)"; }, 400);
    }
  }

  function startJungleMusic() {
    if (musicStartedRef.current) return;
    musicStartedRef.current = true;
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      audioCtxRef.current = ctx;
      const master = ctx.createGain();
      master.gain.value = 0.38;
      master.connect(ctx.destination);

      const BPM = 122;
      const beat = 60 / BPM;
      const NOTES = [196, 233, 261, 294, 349, 392, 466]; // G min pentatonic
      const MELODY = [0, -1, 2, -1, 4, 3, -1, 2, 0, -1, 1, -1, 3, 2, -1, 0];
      let nextTime = ctx.currentTime + 0.05;
      let step = 0;

      function schedule() {
        while (nextTime < ctx.currentTime + 0.2) {
          // Kick drum
          if (step % 8 === 0 || step % 8 === 4) {
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.connect(g); g.connect(master);
            o.frequency.setValueAtTime(160, nextTime);
            o.frequency.exponentialRampToValueAtTime(0.01, nextTime + 0.28);
            g.gain.setValueAtTime(0.85, nextTime);
            g.gain.exponentialRampToValueAtTime(0.001, nextTime + 0.28);
            o.start(nextTime); o.stop(nextTime + 0.3);
          }
          // Snare
          if (step % 16 === 4 || step % 16 === 12) {
            const buf = ctx.createBuffer(1, ctx.sampleRate * 0.1, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            const s = ctx.createBufferSource(); const g = ctx.createGain();
            const f = ctx.createBiquadFilter(); f.type = "bandpass"; f.frequency.value = 2500;
            s.buffer = buf; s.connect(f); f.connect(g); g.connect(master);
            g.gain.setValueAtTime(0.35, nextTime);
            g.gain.exponentialRampToValueAtTime(0.001, nextTime + 0.1);
            s.start(nextTime);
          }
          // Hi-hat
          {
            const buf = ctx.createBuffer(1, ctx.sampleRate * 0.04, ctx.sampleRate);
            const d = buf.getChannelData(0);
            for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
            const s = ctx.createBufferSource(); const g = ctx.createGain();
            const f = ctx.createBiquadFilter(); f.type = "highpass"; f.frequency.value = 8000;
            s.buffer = buf; s.connect(f); f.connect(g); g.connect(master);
            g.gain.setValueAtTime(step % 4 === 0 ? 0.09 : 0.035, nextTime);
            g.gain.exponentialRampToValueAtTime(0.001, nextTime + 0.04);
            s.start(nextTime);
          }
          // Melody
          const mIdx = MELODY[step % MELODY.length];
          if (mIdx >= 0) {
            const o = ctx.createOscillator(); const g = ctx.createGain();
            o.type = "triangle"; o.connect(g); g.connect(master);
            o.frequency.value = NOTES[mIdx];
            g.gain.setValueAtTime(0.22, nextTime);
            g.gain.exponentialRampToValueAtTime(0.001, nextTime + beat * 0.75);
            o.start(nextTime); o.stop(nextTime + beat);
          }
          nextTime += beat / 2;
          step++;
        }
      }

      const interval = setInterval(schedule, 50);
      schedule();
      musicControlRef.current = {
        stop() { clearInterval(interval); master.gain.linearRampToValueAtTime(0, ctx.currentTime + 0.3); },
        setVolume(v: number) { master.gain.setValueAtTime(v, ctx.currentTime); },
      };
    } catch { /* audio not supported */ }
  }

  function toggleMusic() {
    if (!musicStartedRef.current) {
      startJungleMusic();
      setMusicOn(true);
      return;
    }
    const next = !musicOn;
    setMusicOn(next);
    musicControlRef.current?.setVolume(next ? 0.38 : 0);
  }

  function takeBananaCore(amount: number) {
    const now = Date.now();
    let pts = amount * (holderBoostRef.current ? 3 : 1) * skinBoostRef.current;
    if (now - lastClickRef.current < 800) {
      comboCountRef.current++;
      pts += Math.floor(comboCountRef.current / 3);
    } else {
      comboCountRef.current = 0;
    }
    lastClickRef.current = now;
    const newScore = scoreRef.current + pts;
    scoreRef.current = newScore;
    if (newScore > personalBestRef.current) { personalBestRef.current = newScore; setPersonalBest(newScore); }

    const currentLevel = levelRef.current;
    const currentNeeded = bananasNeededRef.current;
    const target = currentLevel * currentNeeded;
    if (newScore >= target && currentLevel < 30) {
      const nl = currentLevel + 1;
      const nn = Math.floor(currentNeeded * 1.25);
      levelRef.current = nl;
      bananasNeededRef.current = nn;
      setLevel(nl);
      setBananasNeeded(nn);
      animateApe(1.4);
      setLevelMsg(`LEVEL ${nl} UNLOCKED!`);
      setShowLevelMsg(true);
      setTimeout(() => setShowLevelMsg(false), 1800);
      if (nl === 5) showToast("🔥 KING MODE ACTIVATED! You are now a true Banana Lord!", "info");
      if (nl === 10) showToast("👑 YOU ARE THE ULTIMATE KING OF THE JUNGLE! 🦍", "success");
    }
    setScore(newScore);
    setShowInstruction(false);
  }

  function spawnParticle(type: string, x?: number, y?: number) {
    const id = ++particleIdRef.current;
    const px = x !== undefined ? x : Math.random() * 70 + 15;
    const py = y !== undefined ? y : Math.random() * 40 + 25;
    setParticles(prev => [...prev, { id, x: px, y: py, type }]);
    setTimeout(() => setParticles(prev => prev.filter(p => p.id !== id)), 820);
  }

  const handleGameClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest("button")) return;
    const c = gameContainerRef.current;
    if (!c) return;
    startJungleMusic();
    const rect = c.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((y) / rect.height) * 100;
    if (y > 60 && y < rect.height - 70) {
      takeBananaCore(1);
      spawnParticle("🍌", x, yPct);
      if (Math.random() < 0.22) setTimeout(() => takeBananaCore(2), 180);
    }
  }, []);

  const handleGameTouch = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    e.preventDefault();
    const c = gameContainerRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const t = e.touches[0];
    const y = t.clientY - rect.top;
    const x = ((t.clientX - rect.left) / rect.width) * 100;
    const yPct = (y / rect.height) * 100;
    if (y > 60 && y < rect.height - 70) {
      takeBananaCore(1);
      spawnParticle("🍌", x, yPct);
    }
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === " " || e.key === "Enter") {
        const submitInput = document.getElementById("submit-name-input");
        if (document.activeElement !== submitInput) {
          e.preventDefault();
          takeBananaCore(1);
          spawnParticle("🍌");
        }
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      if (scoreRef.current > 5 && Math.random() < 0.32) spawnParticle("💣");
    }, 6000);
    return () => clearInterval(interval);
  }, []);

  function resetGame() {
    scoreRef.current = 0; levelRef.current = 1; bananasNeededRef.current = 10000; comboCountRef.current = 0;
    setScore(0); setLevel(1); setBananasNeeded(10000); setShowInstruction(true);
  }

  const currentTarget = level * bananasNeeded;
  const progressPct = Math.min((score / currentTarget) * 100, 100);

  useEffect(() => {
    fetch("/api/leaderboard/week")
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data && data.length > 0) setLeaderboard(data); })
      .catch(() => {});
  }, []);

  async function checkHolder() {
    if (!wallet.address || !wallet.provider) {
      showToast("⚠️ Connect your wallet first!", "error");
      setHolderModal(false);
      setWalletModal(true);
      return;
    }
    setHolderModal(false);
    showToast("⏳ Checking $APES balance...", "info");
    try {
      const apes = new ethers.Contract(SKIN_CONTRACT_ADDR, ERC20_ABI, wallet.provider);
      const [bal, dec] = await Promise.all([apes.balanceOf(wallet.address), apes.decimals()]);
      const balance = parseFloat(ethers.utils.formatUnits(bal, dec));
      if (balance >= 10000000) {
        setHolderBoost(true);
        showToast(`🎉 3x BOOST ACTIVATED! Balance: ${balance.toLocaleString()} $APES`, "success");
      } else {
        showToast(`❌ Need 10M $APES. Your balance: ${balance.toLocaleString()}`, "error");
      }
    } catch {
      showToast("⚠️ Could not read balance — $APES contract may not be live yet", "error");
    }
  }

  async function submitScore() {
    const name = submitName.trim();
    if (!name) { showToast("⚠️ Enter your ape name first!", "error"); return; }
    if (!wallet.address || !wallet.signer) { showToast("⚠️ Connect your wallet!", "error"); return; }
    setSubmitting(true);
    try {
      const currentScore = Math.floor(scoreRef.current);
      const timestamp = new Date().toISOString();
      const message = `Planet Apes Score Submission\nPlayer: ${name}\nScore: ${currentScore}\nWallet: ${wallet.address}\nTimestamp: ${timestamp}`;
      showToast("✍️ Sign the message in your wallet to verify your score...", "info");
      let signature: string;
      try {
        signature = await wallet.signer.signMessage(message);
      } catch (err: unknown) {
        const e = err as { code?: number; message?: string };
        if (e?.code === 4001 || (e?.message || "").includes("rejected")) showToast("❌ Signing cancelled", "error");
        else showToast(`❌ Sign failed: ${(e?.message || "").slice(0, 60)}`, "error");
        return;
      }
      showToast("⏳ Submitting your verified score...", "info");
      const res = await fetch("/api/leaderboard/submit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, score: currentScore, wallet_address: wallet.address, signature, message }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error || "Submit failed");
      setSubmitModal(false);
      showToast(`🏆 Score verified & submitted! You're ranked #${result.rank}!`, "success");
      fetch("/api/leaderboard/week").then(r => r.ok ? r.json() : null).then(data => { if (data && data.length > 0) setLeaderboard(data); }).catch(() => {});
    } catch (err: unknown) {
      const e = err as { message?: string };
      const msg = e?.message || "";
      if (msg.includes("Signature does not match")) showToast("❌ Signature mismatch — sign with connected wallet", "error");
      else showToast(`❌ Submit failed: ${msg.slice(0, 80)}`, "error");
    } finally {
      setSubmitting(false);
    }
  }

  function equipSkin(name: string, boostVal: number) {
    const imgs: Record<string, string> = {
      "King Ape": "https://i.imgur.com/YestlX1.jpg",
      "Banana God": "https://i.imgur.com/eyQoioN.jpg",
      "Degen Ape": "https://i.imgur.com/7VFGhCb.jpg",
      "Jungle Chad": "https://i.imgur.com/4rUjNtO.jpg",
    };
    setEquippedSkin(name);
    setSkinBoost(boostVal);
    skinBoostRef.current = boostVal;
    localStorage.setItem("planetApesCurrentSkin", name);
    setApeImg(imgs[name] || "https://i.imgur.com/KlM5HWE.jpg");
    showToast(`🦍 ${name} equipped! ${boostVal}x boost active!`, "success");
  }

  async function buySkin(name: string, priceUsdm: number, boostVal: number) {
    if (!wallet.address || !wallet.signer) {
      showToast("⚠️ Connect your wallet before buying a skin!", "error");
      setWalletModal(true);
      return;
    }
    if (!confirm(`🦍 Buy "${name}" for ${priceUsdm} USDM?\n\n💰 90% → Community Treasury\n10% → Dev Wallet\n\nYour wallet will prompt:\n1️⃣ Approve USDM\n2️⃣ Buy skin`)) return;
    try {
      const usdm = new ethers.Contract(USDM_ADDRESS, ERC20_ABI, wallet.signer);
      const skin = new ethers.Contract(SKIN_CONTRACT_ADDR, SKIN_ABI, wallet.signer);
      const decimals = await usdm.decimals();
      const amount = ethers.utils.parseUnits(priceUsdm.toString(), decimals);
      const balance = await usdm.balanceOf(wallet.address);
      if (balance.lt(amount)) { showToast(`❌ Insufficient USDM! Need ${priceUsdm} USDM.`, "error"); return; }
      const allowance = await usdm.allowance(wallet.address, SKIN_CONTRACT_ADDR);
      if (allowance.lt(amount)) {
        showToast("⏳ Step 1/2: Approve USDM in your wallet...", "info");
        const approveTx = await usdm.approve(SKIN_CONTRACT_ADDR, amount);
        showToast("⏳ Waiting for approval on-chain...", "info");
        await approveTx.wait();
        showToast("✅ Approval confirmed!", "success");
      }
      showToast("⏳ Step 2/2: Confirm purchase in your wallet...", "info");
      const skinId = SKIN_IDS[name];
      const buyTx = await skin.buySkin(skinId);
      showToast("⏳ Waiting for on-chain confirmation...", "info");
      const receipt = await buyTx.wait();
      const newOwned = [...ownedSkins, name];
      setOwnedSkins(newOwned);
      localStorage.setItem("planetApesOwnedSkins", JSON.stringify(newOwned));
      setTreasury(t => t + priceUsdm);
      equipSkin(name, boostVal);
      showToast(`🎉 ${name} purchased! Tx: ${receipt.transactionHash.slice(0, 10)}...`, "success");
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      const msg = e?.message || "";
      if (e?.code === 4001 || msg.includes("rejected") || msg.includes("denied")) showToast("❌ Transaction cancelled", "error");
      else if (msg.includes("insufficient funds")) showToast("❌ Not enough ETH for gas fees", "error");
      else showToast(`❌ Error: ${msg.slice(0, 120)}`, "error");
    }
  }

  const detectedWallets = getWallets();
  const browserName = getBrowserName();
  const installLinks = getInstallLinks();

  return (
    <div style={{ fontFamily: "'Inter', system-ui, sans-serif", background: "#000", color: "#fff", overflowX: "hidden" }}>
      {/* ─── NAVBAR ─── */}
      <nav style={{
        position: "fixed", top: 0, left: 0, right: 0, zIndex: 9000,
        background: "rgba(0,0,0,0.95)",
        borderBottom: "1px solid rgba(250,204,21,0.3)",
        backdropFilter: "blur(12px)",
        padding: "0 1.5rem",
        display: "flex", alignItems: "center", justifyContent: "space-between",
        height: "68px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <img src="https://i.imgur.com/KlM5HWE.jpg" alt="APES" style={{ width: 40, height: 40, borderRadius: "50%", border: "2px solid #FFD700", objectFit: "cover" }} />
          <span className="pixel-font" style={{ fontSize: "0.75rem", color: "#FFD700", letterSpacing: 1 }}>PLANET&nbsp;APES</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "2rem" }}>
          {[["game", "TAKE BANANA"], ["tokenomics", "TOKENOMICS"], ["how", "HOW TO BUY"], ["community", "COMMUNITY"]].map(([id, label]) => (
            <a key={id} href={`#${id}`} onClick={e => { e.preventDefault(); smoothScroll(id); }}
              style={{ color: "#9CA3AF", fontSize: "0.8rem", fontWeight: 600, letterSpacing: 1, transition: "color 0.2s", display: "block" }}
              className="nav-link"
              onMouseEnter={e => (e.currentTarget.style.color = "#FFD700")}
              onMouseLeave={e => (e.currentTarget.style.color = "#9CA3AF")}>{label}</a>
          ))}
        </div>
        <div style={{ display: "flex", gap: "0.75rem" }}>
          <button onClick={() => window.open("https://x.com/planetapesxyz", "_blank")}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1rem", borderRadius: "0.75rem", border: "1px solid rgba(255,255,255,0.3)", background: "rgba(255,255,255,0.05)", color: "#fff", fontSize: "0.75rem", fontWeight: 700, transition: "all 0.2s" }}>
            𝕏 @planetapesxyz
          </button>
          <button onClick={() => setWalletModal(true)}
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", padding: "0.5rem 1.25rem", borderRadius: "0.75rem", border: "none", background: wallet.address ? "#22c55e" : "#FFD700", color: "#000", fontSize: "0.75rem", fontWeight: 900, transition: "all 0.2s", letterSpacing: 1 }}>
            🦊 {wallet.address ? `${wallet.address.slice(0, 6)}...${wallet.address.slice(-4)}` : "CONNECT"}
          </button>
        </div>
      </nav>

      {/* ─── HERO ─── */}
      <section id="hero" style={{
        minHeight: "100vh", paddingTop: 68,
        background: "radial-gradient(ellipse at top, #0a2f1e 0%, #000 60%)",
        position: "relative", overflow: "hidden",
        display: "flex", alignItems: "center",
      }}>
        <div style={{ position: "absolute", inset: 0, background: "radial-gradient(ellipse at 50% 0%, rgba(250,204,21,0.08) 0%, transparent 60%)" }} />
        <div style={{ maxWidth: "64rem", margin: "0 auto", padding: "3rem 1.5rem", textAlign: "center", position: "relative", zIndex: 10, width: "100%" }}>
          <div className="float-1" style={{ position: "absolute", top: "-2.5rem", left: "25%", fontSize: "3.5rem", pointerEvents: "none", userSelect: "none" }}>🍌</div>
          <div className="float-2" style={{ position: "absolute", top: "5rem", right: "22%", fontSize: "2.75rem", pointerEvents: "none", userSelect: "none" }}>🍌</div>

          <div style={{ display: "flex", justifyContent: "center", marginBottom: "2rem" }}>
            <div style={{ position: "relative" }}>
              <img src="https://i.imgur.com/KlM5HWE.jpg" alt="Planet Apes" style={{ width: "min(20rem,80vw)", height: "min(20rem,80vw)", borderRadius: "50%", border: "12px solid #FFD700", boxShadow: "0 0 120px #FFD700", objectFit: "cover" }} />
              <div className="animate-pulse-custom" style={{ position: "absolute", inset: "-1rem", borderRadius: "50%", border: "4px solid rgba(168,85,247,0.5)" }} />
            </div>
          </div>

          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.75rem", padding: "0.5rem 1.5rem", background: "#FFD700", color: "#000", borderRadius: "9999px", marginBottom: "1rem" }}>
            <div className="animate-pulse-custom" style={{ width: "0.75rem", height: "0.75rem", background: "#22c55e", borderRadius: "50%" }} />
            <span style={{ fontWeight: 900, fontSize: "0.875rem", letterSpacing: 3 }}>LIVE ON MEGAETH</span>
          </div>

          <h1 className="pixel-font" style={{ fontSize: "clamp(3rem,10vw,5rem)", lineHeight: 1, color: "#fff", marginBottom: "0.5rem" }}>PLANET<br />APES</h1>
          <p style={{ fontSize: "2rem", fontWeight: 900, color: "#FACC15", letterSpacing: 4, marginTop: "-0.25rem", marginBottom: "1.5rem" }}>KING OF THE JUNGLE</p>

          <p style={{ maxWidth: "42rem", margin: "0 auto 1.5rem", fontSize: "1.2rem", color: "#D1D5DB" }}>
            The most based meme coin on <span style={{ color: "#34D399", fontWeight: 700 }}>MegaETH</span>.<br />
            Take bananas. Rule the jungle. <span style={{ color: "#FACC15" }}>To the moon.</span>
          </p>

          <div style={{ maxWidth: "36rem", margin: "0 auto 2rem", padding: "0.75rem 1rem", background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.4)", borderRadius: "1rem" }}>
            <div style={{ color: "#FACC15", fontWeight: 900, fontSize: "1rem" }}>🍌 ONLY 10M+ HOLDERS GET 3x BOOST! 🍌</div>
            <div style={{ fontSize: "0.875rem", color: "#D1D5DB", marginTop: "0.25rem" }}>Connect your wallet → Verify your balance → Earn 3x bananas instantly</div>
          </div>

          <div style={{ display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "center", alignItems: "center" }}>
            <button onClick={() => window.open("https://kumbaya.xyz", "_blank")}
              style={{ padding: "1.25rem 3.5rem", background: "linear-gradient(90deg,#FFD700,#F59E0B)", color: "#000", fontWeight: 900, fontSize: "1.1rem", borderRadius: "1rem", border: "none", display: "flex", alignItems: "center", gap: "0.75rem", boxShadow: "0 10px 40px rgba(255,215,0,0.5)", cursor: "pointer" }}>
              <span>BUY $APES NOW</span><span>🚀</span>
            </button>
            <button onClick={() => smoothScroll("game")}
              style={{ padding: "1.25rem 2.5rem", border: "4px solid #FFD700", background: "transparent", color: "#fff", fontWeight: 900, fontSize: "1.1rem", borderRadius: "1rem", cursor: "pointer" }}>
              🎮 PLAY TAKE BANANA
            </button>
          </div>

          <div style={{ marginTop: "2.5rem", display: "flex", justifyContent: "center", gap: "2rem", fontSize: "0.875rem", opacity: 0.75, flexWrap: "wrap" }}>
            {["FAIR LAUNCH", "0 TAX", "LP BURNED"].map(t => (
              <div key={t} style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}><span style={{ color: "#34D399" }}>✔</span>{t}</div>
            ))}
          </div>

          <div style={{ marginTop: "1.5rem" }}>
            <button onClick={() => setHolderModal(true)}
              style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.625rem 1.5rem", background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.5)", borderRadius: "9999px", color: "#FACC15", fontSize: "0.875rem", fontWeight: 700, cursor: "pointer" }}>
              💎 Are You a 10M Holder? Get 3x Boost
            </button>
          </div>
        </div>

        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, background: "rgba(0,0,0,0.8)", padding: "0.75rem 0", borderTop: "1px solid rgba(234,179,8,0.3)", overflow: "hidden" }}>
          <div className="ticker-inner">
            {["🍌 $150 PRIZE POOL — TOP 3 WINS! 🍌", "🐵 10M HOLDERS = 3x BOOST 🐵", "🏆 WEEKLY LEADERBOARD 🏆", "🚀 BUY $APES ON KUMBAYA.XYZ 🚀", "🦍 KING OF THE JUNGLE ON MEGAETH 🦍",
              "🍌 $150 PRIZE POOL — TOP 3 WINS! 🍌", "🐵 10M HOLDERS = 3x BOOST 🐵", "🏆 WEEKLY LEADERBOARD 🏆", "🚀 BUY $APES ON KUMBAYA.XYZ 🚀", "🦍 KING OF THE JUNGLE ON MEGAETH 🦍"].map((t, i) => (
              <span key={i}>{t}</span>
            ))}
          </div>
        </div>
      </section>

      {/* ─── LAUNCHED ON ─── */}
      <div style={{ background: "#0a0a0a", borderBottom: "1px solid rgba(234,179,8,0.2)", padding: "1.25rem", textAlign: "center" }}>
        <div style={{ color: "#FACC15", fontSize: "0.75rem", letterSpacing: "0.2em" }}>LAUNCHED ON</div>
        <div style={{ fontSize: "2.25rem", fontWeight: 900, color: "#34D399" }}>KUMBAYA.XYZ</div>
      </div>

      {/* ─── GAME ─── */}
      <section id="game" style={{ maxWidth: "64rem", margin: "0 auto", padding: "5rem 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ display: "inline-block", padding: "0.375rem 1.25rem", background: "rgba(168,85,247,0.2)", color: "#C084FC", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.75rem" }}>INTERACTIVE EXPERIENCE</div>
          <h2 className="pixel-font section-header">TAKE BANANA</h2>
          <p style={{ marginTop: "0.75rem", fontSize: "1.15rem", color: "#9CA3AF", maxWidth: "28rem", marginLeft: "auto", marginRight: "auto" }}>
            Click the bananas to feed the King Ape. The more you take, the richer you become!
          </p>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "2rem", justifyContent: "center" }}>
          <div style={{ flex: 1, minWidth: 280, maxWidth: 620 }}>
            <div
              ref={gameContainerRef}
              className="game-container"
              onClick={handleGameClick}
              onTouchStart={handleGameTouch}
            >
              <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", opacity: 0.18, pointerEvents: "none", fontSize: 180 }}>🌴</div>

              <div style={{ position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", zIndex: 20, pointerEvents: "none", textAlign: "center" }}>
                <div style={{ position: "relative" }}>
                  <img ref={apeImgElRef} src={apeImg} style={{ width: "10rem", height: "10rem", borderRadius: "50%", border: "8px solid #FFD700", boxShadow: "0 0 60px #FFD700", objectFit: "cover", transition: "transform 0.3s cubic-bezier(0.34,1.56,0.64,1)" }} alt="Ape" />
                  <div style={{ position: "absolute", top: "-0.75rem", left: "50%", transform: "translateX(-50%)", fontSize: "2rem" }}>👑</div>
                </div>
              </div>

              <div style={{ position: "absolute", top: "1.5rem", right: "1.5rem", background: "rgba(0,0,0,0.85)", padding: "0.75rem 1.5rem", borderRadius: "1rem", border: "1px solid #FFD700", zIndex: 30, pointerEvents: "none", textAlign: "center" }}>
                <div style={{ fontSize: "0.65rem", color: "#FACC15", letterSpacing: "0.1em" }}>BANANAS COLLECTED</div>
                <div style={{ fontSize: "2.5rem", fontWeight: 900, color: "#FACC15", fontFamily: "monospace" }}>{Math.floor(score).toLocaleString()}</div>
              </div>

              <div style={{ position: "absolute", top: "1.5rem", left: "1.5rem", background: "rgba(0,0,0,0.85)", padding: "0.5rem 1.25rem", borderRadius: "1rem", border: "1px solid #a855f7", zIndex: 30, pointerEvents: "none" }}>
                <div style={{ fontSize: "0.65rem", color: "#C084FC" }}>KING LEVEL</div>
                <div style={{ fontSize: "1.75rem", fontWeight: 900, color: "#C084FC" }}>{level}</div>
              </div>

              {showPowerup && (
                <div style={{ display: "block", position: "absolute", top: "1rem", left: "50%", transform: "translateX(-50%)", background: "#3B82F6", color: "#fff", padding: "0.25rem 1rem", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: 700, zIndex: 50, pointerEvents: "none" }}>
                  ⚡ DOUBLE BANANA ACTIVE!
                </div>
              )}

              {showLevelMsg && (
                <div style={{ position: "absolute", top: "33%", left: "50%", transform: "translateX(-50%)", background: "#FFD700", color: "#000", padding: "0.5rem 2rem", borderRadius: "2rem", fontWeight: 900, fontSize: "1.25rem", zIndex: 50, boxShadow: "0 0 40px #FFD700", whiteSpace: "nowrap", pointerEvents: "none" }}>
                  {levelMsg}
                </div>
              )}

              {particles.map(p => (
                <div key={p.id} className="float-particle" style={{ left: `${p.x}%`, top: `${p.y}%` }}>{p.type}</div>
              ))}

              <div style={{ position: "absolute", bottom: "1.5rem", left: "1.5rem", right: "1.5rem", zIndex: 30, pointerEvents: "none" }}>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.6rem", color: "rgba(250,204,21,0.7)", marginTop: "0.25rem", fontFamily: "monospace" }}>
                  <span>LVL {level}</span>
                  <span>{Math.floor(score).toLocaleString()}/{currentTarget.toLocaleString()}</span>
                </div>
              </div>

              {/* Music toggle */}
              <button
                onClick={toggleMusic}
                style={{ position: "absolute", bottom: "1.5rem", right: "1.5rem", zIndex: 40, background: "rgba(0,0,0,0.75)", border: `1px solid ${musicOn ? "#FFD700" : "rgba(255,255,255,0.2)"}`, borderRadius: "9999px", padding: "0.35rem 0.9rem", color: musicOn ? "#FFD700" : "#6B7280", fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.35rem", cursor: "pointer", backdropFilter: "blur(4px)" }}
              >
                {musicOn ? "🎵 ON" : "🔇 OFF"}
              </button>

              {showInstruction && (
                <div style={{ position: "absolute", bottom: "5.5rem", left: "50%", transform: "translateX(-50%)", textAlign: "center", zIndex: 30, pointerEvents: "none" }}>
                  <div style={{ color: "#FACC15", fontSize: "0.875rem", letterSpacing: 2 }}>👆 CLICK ANYWHERE TO TAKE BANANAS!</div>
                </div>
              )}
            </div>

            <div style={{ display: "flex", justifyContent: "center", marginTop: "1.5rem" }}>
              <button onClick={resetGame} style={{ padding: "0.75rem 2rem", border: "1px solid rgba(255,255,255,0.3)", background: "transparent", color: "#fff", fontWeight: 700, borderRadius: "1rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.875rem" }}>
                ↺ RESET JUNGLE
              </button>
            </div>
            <div style={{ textAlign: "center", marginTop: "1rem", fontSize: "0.75rem", color: "#6B7280" }}>
              Every 10,000 bananas × level = level up • Reach level 10 for special reward!
            </div>
          </div>

          {/* Leaderboard */}
          <div style={{ width: "100%", maxWidth: 320, flexShrink: 0 }}>
            <div style={{ background: "#111", border: "1px solid rgba(250,204,21,0.3)", borderRadius: "1.5rem", padding: "1.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1rem" }}>
                <div>
                  <div style={{ fontWeight: 900, fontSize: "1.4rem" }}>🏆 LEADERBOARD</div>
                  <div style={{ fontSize: "0.6rem", color: "#FACC15", letterSpacing: 1, marginTop: "-2px" }}>TOP 3 • HIGHEST SCORES WIN $150 • WEEKLY</div>
                </div>
                <button onClick={() => { if (Math.floor(score) === 0) { showToast("⚠️ Play the game first!", "error"); return; } setSubmitModal(true); }}
                  style={{ padding: "0.5rem 1.25rem", fontSize: "0.75rem", background: "linear-gradient(90deg,#FFD700,#F59E0B)", color: "#000", fontWeight: 900, borderRadius: "1rem", border: "none" }}>
                  SUBMIT
                </button>
              </div>

              <div style={{ fontSize: "0.875rem", maxHeight: 200, overflowY: "auto", paddingRight: "0.5rem", display: "flex", flexDirection: "column", gap: "0.375rem" }}>
                {leaderboard.slice(0, 8).map((entry, i) => (
                  <div key={i} className="lb-row-anim" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "7px 0.75rem", borderRadius: "1rem", animationDelay: `${i * 60}ms`, ...(i < 3 ? { background: "rgba(250,204,21,0.1)", border: "1px solid rgba(250,204,21,0.3)" } : { background: "rgba(0,0,0,0.4)" }) }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                      <div style={{ minWidth: 28, textAlign: "right", fontFamily: "monospace", fontSize: "0.75rem", fontWeight: 700, color: "#FACC15", paddingRight: "0.25rem" }}>{i + 1}</div>
                      <div style={{ fontWeight: 700 }}>{escHtml(entry.name)}{i < 3 ? " " + MEDALS[i] : ""}</div>
                    </div>
                    <div style={{ fontFamily: "monospace", color: "#FACC15", fontSize: "0.875rem" }}>{Math.floor(entry.score).toLocaleString()}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: "1.25rem", background: "rgba(0,0,0,0.4)", padding: "0.75rem", borderRadius: "0.75rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ color: "#9CA3AF", fontSize: "0.75rem" }}>YOUR BEST</div>
                    <div style={{ fontSize: "0.65rem", color: "#6B7280" }}>Submit to enter leaderboard</div>
                  </div>
                  <div style={{ fontFamily: "monospace", fontWeight: 900, color: "#FACC15", fontSize: "1.5rem" }}>{Math.floor(personalBest).toLocaleString()}</div>
                </div>
              </div>
            </div>
            <div style={{ textAlign: "center", fontSize: "0.65rem", color: "#6B7280", marginTop: "0.5rem" }}>Submit your high score to climb the ranks!</div>
            <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "0.6rem", color: "#6B7280", lineHeight: 1.5 }}>
              <strong>LEADERBOARD RULES:</strong> Top 3 highest scores at end of every week win $150 total. One submission per wallet. No bots. Fair play only. <span style={{ color: "#FACC15" }}>Resets every Sunday at 00:00 UTC.</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── TOKENOMICS ─── */}
      <section id="tokenomics" style={{ background: "linear-gradient(180deg, #000 0%, #0a0a0a 100%)", padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: "64rem", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div style={{ display: "inline-block", padding: "0.375rem 1.25rem", background: "rgba(250,204,21,0.15)", color: "#FACC15", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.75rem" }}>TOKENOMICS</div>
            <h2 className="pixel-font" style={{ fontSize: "clamp(1.8rem,5vw,3rem)", fontWeight: 900, color: "#fff", marginBottom: "0.5rem" }}>THE ECONOMICS</h2>
            <p style={{ color: "#9CA3AF", fontSize: "1rem", marginTop: "0.5rem" }}>Simple, fair, and transparent.</p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))", gap: "1.5rem" }}>
            {[
              { label: "TOTAL SUPPLY", value: "1,000,000,000", sub: "$APES forever", color: "#FFD700" },
              { label: "BUY/SELL TAX", value: "0%", sub: "Zero tax — keep every banana", color: "#34D399" },
              { label: "LP BURNED", value: "100%", sub: "Liquidity locked forever", color: "#C084FC" },
              { label: "OWNER", value: "Renounced", sub: "No control, true community coin", color: "#F59E0B" },
            ].map(item => (
              <div key={item.label} style={{ background: "#111", border: "1px solid rgba(250,204,21,0.3)", borderRadius: "1.5rem", padding: "2rem", textAlign: "center" }}>
                <div style={{ fontSize: "0.75rem", color: "#9CA3AF", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>{item.label}</div>
                <div style={{ fontSize: "clamp(1.5rem,4vw,2.5rem)", fontWeight: 900, color: item.color }}>{item.value}</div>
                <div style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: "0.5rem" }}>{item.sub}</div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: "3rem", background: "#111", border: "1px solid rgba(250,204,21,0.3)", borderRadius: "1.5rem", padding: "2rem" }}>
            <h3 style={{ fontWeight: 900, fontSize: "1.25rem", marginBottom: "1rem" }}>📊 Token Distribution</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {[
                { label: "Public Sale / Liquidity", pct: 80, color: "#FFD700" },
                { label: "Community Rewards / Leaderboard", pct: 10, color: "#34D399" },
                { label: "Development & Marketing", pct: 10, color: "#C084FC" },
              ].map(item => (
                <div key={item.label}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.875rem", marginBottom: "0.25rem" }}>
                    <span>{item.label}</span><span style={{ color: item.color, fontWeight: 700 }}>{item.pct}%</span>
                  </div>
                  <div className="progress-track">
                    <div className="progress-fill" style={{ width: `${item.pct}%`, background: item.color }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ─── HOW TO BUY ─── */}
      <section id="how" style={{ maxWidth: "64rem", margin: "0 auto", padding: "5rem 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ display: "inline-block", padding: "0.375rem 1.25rem", background: "rgba(52,211,153,0.2)", color: "#34D399", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.75rem" }}>GET STARTED</div>
          <h2 className="pixel-font" style={{ fontSize: "clamp(1.8rem,5vw,3rem)", fontWeight: 900, color: "#fff" }}>HOW TO BUY $APES</h2>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {[
            { num: 1, title: "Install MetaMask", desc: "Download MetaMask from metamask.io and create or import your wallet. Available for Chrome, Firefox, Brave, and Edge." },
            { num: 2, title: "Add MegaETH Mainnet", desc: `Add MegaETH to MetaMask: Network Name: MegaETH | RPC: https://mainnet.megaeth.com/rpc | Chain ID: 4326 | Symbol: ETH | Explorer: https://mega.etherscan.io` },
            { num: 3, title: "Get ETH on MegaETH", desc: "Bridge ETH from Ethereum mainnet or another chain to MegaETH using the official bridge. You'll need ETH for gas fees." },
            { num: 4, title: "Buy $APES on Kumbaya", desc: "Visit kumbaya.xyz, connect your wallet, and swap ETH for $APES. The contract is verified and liquidity is burned." },
          ].map(step => (
            <div key={step.num} style={{ display: "flex", alignItems: "flex-start", gap: "1.5rem", background: "#111", borderRadius: "1.5rem", padding: "1.5rem", border: "1px solid rgba(250,204,21,0.2)" }}>
              <div style={{ minWidth: "3rem", height: "3rem", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(135deg,#FFD700,#F59E0B)", color: "#000", fontWeight: 900, fontSize: "1.5rem", borderRadius: "50%", flexShrink: 0 }}>{step.num}</div>
              <div>
                <div style={{ fontWeight: 900, fontSize: "1.1rem", marginBottom: "0.5rem" }}>{step.title}</div>
                <div style={{ color: "#9CA3AF", fontSize: "0.9rem", lineHeight: 1.7 }}>{step.desc}</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ marginTop: "2rem", textAlign: "center" }}>
          <button onClick={() => window.open("https://kumbaya.xyz", "_blank")}
            style={{ padding: "1.25rem 3.5rem", background: "linear-gradient(90deg,#FFD700,#F59E0B)", color: "#000", fontWeight: 900, fontSize: "1.1rem", borderRadius: "1rem", border: "none", cursor: "pointer", boxShadow: "0 10px 40px rgba(255,215,0,0.4)" }}>
            🚀 BUY $APES NOW ON KUMBAYA
          </button>
        </div>
      </section>

      {/* ─── SKINS ─── */}
      <section id="skins" style={{ background: "#0a0a0a", padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: "64rem", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <div style={{ display: "inline-block", padding: "0.375rem 1.25rem", background: "rgba(250,204,21,0.15)", color: "#FACC15", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.75rem" }}>NFT SKINS</div>
            <h2 className="pixel-font" style={{ fontSize: "clamp(1.8rem,5vw,3rem)", fontWeight: 900, color: "#fff", marginBottom: "0.5rem" }}>APE SKINS</h2>
            <p style={{ color: "#9CA3AF", fontSize: "1rem", marginTop: "0.5rem" }}>Exclusive skins that boost your banana earnings</p>
          </div>

          <div style={{ marginBottom: "2rem", background: "#111", border: "1px solid rgba(250,204,21,0.2)", borderRadius: "1.5rem", padding: "1.25rem", display: "flex", flexWrap: "wrap", gap: "1rem", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#9CA3AF", letterSpacing: "0.1em" }}>COMMUNITY TREASURY</div>
              <div style={{ fontWeight: 900, fontSize: "1.5rem", color: "#FACC15" }}>{treasury.toLocaleString()} USDM</div>
            </div>
            <div style={{ display: "flex", gap: "2rem" }}>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>90% Community</div>
                <div style={{ fontWeight: 900, color: "#34D399" }}>{(treasury * 0.9).toFixed(1)} USDM</div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>10% Dev</div>
                <div style={{ fontWeight: 900, color: "#F59E0B" }}>{(treasury * 0.1).toFixed(1)} USDM</div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "1.5rem" }}>
            {SKINS.map((skin, idx) => {
              const isOwned = ownedSkins.includes(skin.name);
              const isEquipped = equippedSkin === skin.name;
              return (
                <div key={skin.name} className="skin-card-anim" style={{ background: "#111", border: isEquipped ? `2px solid ${skin.imgBorder}` : `1px solid ${skin.border}`, borderRadius: "1.5rem", padding: "1.5rem", transition: "transform 0.2s, box-shadow 0.2s", animationDelay: `${idx * 80}ms`, ...(isEquipped ? { boxShadow: `0 0 30px ${skin.imgBorder}55` } : {}) }}
                  onMouseEnter={e => (e.currentTarget.style.transform = "translateY(-4px)")}
                  onMouseLeave={e => (e.currentTarget.style.transform = "translateY(0)")}>
                  <div style={{ position: "relative", marginBottom: "1rem" }}>
                    <img src={skin.img} alt={skin.name} style={{ width: "100%", aspectRatio: "1/1", borderRadius: "1rem", objectFit: "cover", border: `4px solid ${skin.imgBorder}` }} />
                    <div style={{ position: "absolute", top: "0.75rem", right: "0.75rem", background: skin.rarityBg, color: skin.rarityTxt, fontSize: "0.75rem", fontWeight: 900, padding: "0.25rem 0.75rem", borderRadius: "9999px" }}>{skin.rarity}</div>
                    {isEquipped && <div style={{ position: "absolute", top: "0.75rem", left: "0.75rem", background: "#22c55e", color: "#000", fontSize: "0.75rem", fontWeight: 900, padding: "0.25rem 0.75rem", borderRadius: "9999px" }}>✓ EQUIPPED</div>}
                  </div>
                  <div style={{ fontWeight: 900, fontSize: "1.4rem", marginBottom: "0.25rem" }}>{skin.name}</div>
                  <div style={{ fontSize: "0.875rem", color: "#9CA3AF", marginBottom: "1rem" }}>Exclusive ape skin on MegaETH mainnet.</div>
                  <div style={{ fontSize: "0.75rem", color: "#34D399", fontWeight: 700, marginBottom: "0.75rem" }}>⚡ {skin.boost}</div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: "0.75rem", color: "#6B7280" }}>PRICE</div>
                      <div style={{ fontWeight: 900, fontSize: "1.2rem", color: "#FACC15" }}>{skin.price} USDM</div>
                    </div>
                    {isOwned
                      ? <button onClick={() => equipSkin(skin.name, skin.boostVal)} style={{ padding: "0.5rem 1.25rem", background: isEquipped ? "#22c55e" : "#6B7280", color: "#000", fontWeight: 900, borderRadius: "0.75rem", border: "none", fontSize: "0.875rem" }}>{isEquipped ? "✓ ON" : "EQUIP"}</button>
                      : <button onClick={() => buySkin(skin.name, skin.price, skin.boostVal)} style={{ padding: "0.5rem 1.25rem", background: "#FFD700", color: "#000", fontWeight: 900, borderRadius: "0.75rem", border: "none", fontSize: "0.875rem" }}>BUY</button>
                    }
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ─── COMMUNITY ─── */}
      <section id="community" style={{ maxWidth: "64rem", margin: "0 auto", padding: "5rem 1.5rem" }}>
        <div style={{ textAlign: "center", marginBottom: "3rem" }}>
          <div style={{ display: "inline-block", padding: "0.375rem 1.25rem", background: "rgba(168,85,247,0.2)", color: "#C084FC", borderRadius: "9999px", fontSize: "0.875rem", fontWeight: 700, letterSpacing: "0.1em", marginBottom: "0.75rem" }}>JOIN US</div>
          <h2 className="pixel-font" style={{ fontSize: "clamp(1.8rem,5vw,3rem)", fontWeight: 900, color: "#fff" }}>JOIN THE JUNGLE</h2>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(200px,1fr))", gap: "1.5rem" }}>
          {[
            { icon: "𝕏", label: "Twitter / X", desc: "Follow for alpha, memes & updates", url: "https://x.com/planetapesxyz" },
            { icon: "📊", label: "Dexscreener", desc: "Track $APES price live", url: "#" },
            { icon: "🔗", label: "MegaExplorer", desc: "View contract on MegaETH", url: "https://mega.etherscan.io" },
          ].map(item => (
            <div key={item.label} onClick={() => window.open(item.url, "_blank")}
              style={{ background: "#111", border: "1px solid rgba(250,204,21,0.2)", borderRadius: "1.5rem", padding: "2rem", textAlign: "center", cursor: "pointer", transition: "all 0.2s" }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = "#FFD700"; e.currentTarget.style.transform = "translateY(-4px)"; e.currentTarget.style.boxShadow = "0 10px 40px rgba(250,204,21,0.15)"; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = "rgba(250,204,21,0.2)"; e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "none"; }}>
              <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>{item.icon}</div>
              <div style={{ fontWeight: 900, fontSize: "1.25rem", marginBottom: "0.5rem" }}>{item.label}</div>
              <div style={{ color: "#9CA3AF", fontSize: "0.875rem" }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section style={{ background: "#0a0a0a", padding: "5rem 1.5rem" }}>
        <div style={{ maxWidth: "48rem", margin: "0 auto" }}>
          <div style={{ textAlign: "center", marginBottom: "3rem" }}>
            <h2 className="pixel-font" style={{ fontSize: "clamp(1.8rem,5vw,2.5rem)", fontWeight: 900, color: "#fff" }}>FAQ</h2>
          </div>
          <div>
            {FAQS.map((faq, i) => (
              <div key={i} style={{ background: "#111", border: "1px solid rgba(250,204,21,0.2)", borderRadius: "1rem", marginBottom: "0.75rem", overflow: "hidden" }}>
                <div onClick={() => setOpenFaqIdx(openFaqIdx === i ? null : i)}
                  style={{ padding: "1.25rem 1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center", cursor: "pointer", fontWeight: 700 }}
                  onMouseEnter={e => (e.currentTarget.style.background = "rgba(250,204,21,0.05)")}
                  onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <span>{faq.q}</span>
                  <span className={`faq-arrow${openFaqIdx === i ? " open" : ""}`}>▼</span>
                </div>
                <div className={`faq-ans${openFaqIdx === i ? " open" : ""}`}>
                  <div style={{ padding: "0 1.5rem 1.25rem", color: "#9CA3AF", lineHeight: 1.7 }}>{faq.a}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── FOOTER ─── */}
      <footer style={{ background: "#000", borderTop: "1px solid rgba(250,204,21,0.2)", padding: "3rem 1.5rem", textAlign: "center" }}>
        <div style={{ display: "flex", justifyContent: "center", marginBottom: "1.5rem" }}>
          <img src="https://i.imgur.com/KlM5HWE.jpg" alt="APES" style={{ width: 56, height: 56, borderRadius: "50%", border: "2px solid #FFD700", objectFit: "cover" }} />
        </div>
        <div className="pixel-font" style={{ fontSize: "1rem", color: "#FFD700", marginBottom: "0.5rem" }}>PLANET APES</div>
        <div style={{ color: "#6B7280", fontSize: "0.875rem", marginBottom: "1.5rem" }}>The most based meme coin on MegaETH.</div>
        <div style={{ display: "flex", justifyContent: "center", gap: "1.5rem", marginBottom: "2rem", flexWrap: "wrap" }}>
          {[
            { label: "Twitter", url: "https://x.com/planetapesxyz" },
            { label: "Buy $APES", url: "https://kumbaya.xyz" },
            { label: "MegaETH Explorer", url: "https://mega.etherscan.io" },
          ].map(l => (
            <a key={l.label} href={l.url} target="_blank" rel="noreferrer" style={{ color: "#9CA3AF", fontSize: "0.875rem", transition: "color 0.2s" }}
              onMouseEnter={e => (e.currentTarget.style.color = "#FFD700")}
              onMouseLeave={e => (e.currentTarget.style.color = "#9CA3AF")}>{l.label}</a>
          ))}
        </div>
        <div style={{ color: "#4B5563", fontSize: "0.75rem" }}>
          $APES is a meme coin with no intrinsic value. Always do your own research. Not financial advice.
        </div>
        <div style={{ color: "#374151", fontSize: "0.65rem", marginTop: "0.5rem" }}>
          MegaETH Network | Chain ID: 4326 | Contract: {SKIN_CONTRACT_ADDR.slice(0, 6)}...{SKIN_CONTRACT_ADDR.slice(-4)}
        </div>
      </footer>

      {/* ─── WALLET MODAL ─── */}
      {walletModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setWalletModal(false); }}>
          <div className="modal-box">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <div>
                <div style={{ fontWeight: 900, fontSize: "1.5rem" }}>Connect Wallet</div>
                <div style={{ fontSize: "0.75rem", color: "#6B7280", marginTop: "0.25rem" }}>🌐 {browserName} detected</div>
              </div>
              <button onClick={() => setWalletModal(false)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: "1.5rem", lineHeight: 1, cursor: "pointer" }}>✕</button>
            </div>

            {detectedWallets.length === 0 ? (
              <div>
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "1rem", padding: "1rem", marginBottom: "1rem" }}>
                  <div style={{ fontWeight: 700, color: "#ef4444", marginBottom: "0.4rem" }}>❌ No wallet detected</div>
                  <div style={{ fontSize: "0.8rem", color: "#9CA3AF", lineHeight: 1.6 }}>
                    No wallet extension found for {browserName}. Install one below, then reload this page.
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                  {installLinks.map(link => (
                    <button key={link.label} onClick={() => window.open(link.url, "_blank")}
                      style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.875rem 1rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.875rem", color: "#fff", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer", textAlign: "left" }}
                      onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(250,204,21,0.5)")}
                      onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")}>
                      <span style={{ fontSize: "1.5rem" }}>🦊</span>
                      <div>
                        <div>{link.label}</div>
                        <div style={{ fontSize: "0.7rem", color: "#9CA3AF", fontWeight: 400 }}>{link.desc}</div>
                      </div>
                      <span style={{ marginLeft: "auto", color: "#FACC15" }}>↗</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem" }}>
                {detectedWallets.map((w: DetectedWallet) => (
                  <button key={w.type} onClick={() => { connect(w.provider, w.label); setWalletModal(false); }}
                    style={{ display: "flex", alignItems: "center", gap: "1rem", padding: "0.875rem 1rem", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.15)", borderRadius: "0.875rem", color: "#fff", fontWeight: 700, fontSize: "0.875rem", cursor: "pointer", textAlign: "left" }}
                    onMouseEnter={e => (e.currentTarget.style.borderColor = "rgba(250,204,21,0.5)")}
                    onMouseLeave={e => (e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)")}>
                    <span style={{ fontSize: "2rem" }}>{w.icon}</span>
                    <div>
                      <div>{w.label}</div>
                      <div style={{ fontSize: "0.7rem", color: "#9CA3AF", fontWeight: 400 }}>{w.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── HOLDER MODAL ─── */}
      {holderModal && (
        <div className="modal-overlay" onClick={e => { if (e.target === e.currentTarget) setHolderModal(false); }}>
          <div className="modal-box">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <div style={{ fontWeight: 900, fontSize: "1.5rem" }}>💎 Holder Boost</div>
              <button onClick={() => setHolderModal(false)} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: "1.5rem", lineHeight: 1, cursor: "pointer" }}>✕</button>
            </div>
            <p style={{ color: "#9CA3AF", marginBottom: "1.5rem", lineHeight: 1.7 }}>
              Hold <strong style={{ color: "#FACC15" }}>10,000,000+ $APES</strong> to unlock a permanent <strong style={{ color: "#34D399" }}>3x banana boost</strong>!<br /><br />
              Connect your wallet and verify your balance to activate the boost instantly.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>Requirements:</div>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", fontSize: "0.875rem" }}>
                <div>• <span id="req-wallet" style={{ color: wallet.address ? "#34D399" : "#ef4444" }}>{wallet.address ? "Wallet connected ✓" : "Wallet connected ✗"}</span></div>
                <div>• Hold 10,000,000+ $APES tokens</div>
              </div>
              <button onClick={checkHolder}
                style={{ padding: "1rem", background: "linear-gradient(90deg,#FFD700,#F59E0B)", color: "#000", fontWeight: 900, borderRadius: "1rem", border: "none", cursor: "pointer", marginTop: "0.5rem" }}>
                🔍 Verify My Balance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ─── SUBMIT MODAL ─── */}
      {submitModal && (
        <div className="modal-overlay" onClick={e => { if (!submitting && e.target === e.currentTarget) setSubmitModal(false); }}>
          <div className="modal-box">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
              <div style={{ fontWeight: 900, fontSize: "1.5rem" }}>🏆 Submit Score</div>
              <button onClick={() => { if (!submitting) setSubmitModal(false); }} style={{ background: "none", border: "none", color: "#9CA3AF", fontSize: "1.5rem", lineHeight: 1, cursor: "pointer" }}>✕</button>
            </div>
            <div style={{ textAlign: "center", marginBottom: "1.5rem" }}>
              <div style={{ fontSize: "0.75rem", color: "#9CA3AF" }}>YOUR SCORE</div>
              <div style={{ fontFamily: "monospace", fontWeight: 900, fontSize: "3rem", color: "#FACC15" }}>{Math.floor(score).toLocaleString()}</div>
            </div>
            {!wallet.address ? (
              <div>
                <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: "0.75rem", padding: "0.75rem", marginBottom: "1rem", fontSize: "0.875rem", color: "#9CA3AF" }}>
                  Connect your wallet to submit your score to the leaderboard and compete for prizes.
                </div>
                <button onClick={() => { setSubmitModal(false); setWalletModal(true); }}
                  style={{ width: "100%", padding: "0.75rem 1.5rem", background: "#FFD700", color: "#000", fontWeight: 900, borderRadius: "0.75rem", border: "none", cursor: "pointer" }}>
                  CONNECT WALLET
                </button>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: "0.75rem", padding: "0.5rem", background: "rgba(52,211,153,0.1)", border: "1px solid rgba(52,211,153,0.3)", borderRadius: "0.75rem", fontSize: "0.75rem", color: "#34D399", textAlign: "center" }}>
                  ✅ Verified wallet: {wallet.address.slice(0, 6)}...{wallet.address.slice(-4)} on MegaETH
                </div>
                <input id="submit-name-input" type="text" placeholder="Enter your ape name..." maxLength={20} value={submitName} onChange={e => setSubmitName(e.target.value)}
                  style={{ width: "100%", padding: "0.75rem 1rem", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "0.75rem", color: "#fff", fontSize: "0.875rem", outline: "none", marginBottom: "0.25rem" }} />
                <p style={{ fontSize: "0.65rem", color: "#6B7280", textAlign: "center", marginBottom: "1rem" }}>Your wallet will sign a message to prove score authenticity — no gas fees.</p>
                <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem" }}>
                  <button onClick={() => { if (!submitting) setSubmitModal(false); }}
                    style={{ flex: 1, padding: "0.75rem", border: "1px solid rgba(255,255,255,0.2)", background: "transparent", color: "#9CA3AF", fontWeight: 700, borderRadius: "0.75rem", cursor: "pointer" }}>
                    CANCEL
                  </button>
                  <button onClick={submitScore} disabled={submitting}
                    style={{ flex: 1, padding: "0.75rem", background: "linear-gradient(90deg,#FFD700,#F59E0B)", color: "#000", fontWeight: 900, borderRadius: "0.75rem", border: "none", cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}>
                    {submitting ? "⏳ SIGNING..." : "✍️ SIGN & SUBMIT"}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
