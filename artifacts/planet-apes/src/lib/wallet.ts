import { ethers } from "ethers";

export const MEGAETH_CHAIN_ID = "0x10E6"; // 4326 decimal
export const MEGAETH_CONFIG = {
  chainId: MEGAETH_CHAIN_ID,
  chainName: "MegaETH",
  nativeCurrency: { name: "ETH", symbol: "ETH", decimals: 18 },
  rpcUrls: ["https://mainnet.megaeth.com/rpc"],
  blockExplorerUrls: ["https://mega.etherscan.io"],
};

export const USDM_ADDRESS = "0xfafddbb3fc7688494971a79cc65dca3ef82079e7";
export const SKIN_CONTRACT_ADDR = "0x688c8A859C8f846a3A44e4B7fe3c4b85676Bfe95";

export const ERC20_ABI = [
  "function approve(address spender, uint256 amount) returns (bool)",
  "function balanceOf(address owner) view returns (uint256)",
  "function decimals() view returns (uint8)",
  "function allowance(address owner, address spender) view returns (uint256)",
];

export const SKIN_ABI = ["function buySkin(uint256 skinId) external"];
export const SKIN_IDS: Record<string, number> = {
  "King Ape": 0,
  "Banana God": 1,
  "Degen Ape": 2,
  "Jungle Chad": 3,
};

export interface EIP6963ProviderDetail {
  info: { uuid: string; name: string; icon: string; rdns: string };
  provider: EthereumProvider;
}

export interface EthereumProvider {
  isMetaMask?: boolean;
  isCoinbaseWallet?: boolean;
  isCoinbaseBrowser?: boolean;
  isBraveWallet?: boolean;
  request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
  on: (event: string, handler: (...args: unknown[]) => void) => void;
  removeListener?: (event: string, handler: (...args: unknown[]) => void) => void;
  providers?: EthereumProvider[];
}

export interface DetectedWallet {
  type: string;
  label: string;
  icon: string;
  desc: string;
  provider: EthereumProvider;
}

export function detectBrowser() {
  const ua = navigator.userAgent;
  const isMobile = /iPhone|iPad|iPod|Android/i.test(ua);
  const isSafari = /^((?!chrome|android).)*safari/i.test(ua) && !/Chrome|CriOS|FxiOS/.test(ua);
  const isFirefox = /Firefox|FxiOS/.test(ua);
  const isBrave = typeof (navigator as { brave?: unknown }).brave !== "undefined";
  const isEdge = /Edg\//.test(ua);
  const isChrome = /Chrome/.test(ua) && !isEdge && !isBrave;
  return { isMobile, isSafari, isFirefox, isBrave, isEdge, isChrome };
}

export function getBrowserName() {
  const b = detectBrowser();
  if (b.isMobile && b.isSafari) return "Safari Mobile";
  if (b.isMobile) return "Mobile Browser";
  if (b.isSafari) return "Safari";
  if (b.isFirefox) return "Firefox";
  if (b.isBrave) return "Brave";
  if (b.isEdge) return "Microsoft Edge";
  return "Chrome";
}

export function getInstallLinks() {
  const b = detectBrowser();
  if (b.isMobile && b.isSafari)
    return [{ label: "MetaMask iOS App", url: "https://apps.apple.com/app/metamask/id1438144202", desc: "Open this site inside the MetaMask app browser" }];
  if (b.isMobile)
    return [{ label: "MetaMask Mobile", url: "https://metamask.io/download/", desc: "Install MetaMask app, then open this site in it" }];
  if (b.isSafari)
    return [{ label: "MetaMask iOS App", url: "https://apps.apple.com/app/metamask/id1438144202", desc: "Safari desktop does not support wallet extensions" }];
  if (b.isFirefox)
    return [{ label: "MetaMask for Firefox", url: "https://addons.mozilla.org/firefox/addon/ether-metamask/", desc: "Firefox add-on — install then reload" }];
  if (b.isBrave)
    return [
      { label: "Enable Brave Wallet", url: "brave://wallet", desc: "Brave has a built-in wallet — enable it in Settings" },
      { label: "MetaMask for Brave", url: "https://metamask.io/download/", desc: "Or install MetaMask extension for Brave" },
    ];
  if (b.isEdge)
    return [{ label: "MetaMask for Edge", url: "https://microsoftedge.microsoft.com/addons/detail/metamask/ejbalbakoplchlghecdalmeeeajnimhm", desc: "Edge add-on — install then reload" }];
  return [
    { label: "Install MetaMask", url: "https://metamask.io/download/", desc: "Chrome extension — install then reload" },
    { label: "Install Coinbase Wallet", url: "https://www.coinbase.com/wallet/downloads", desc: "Alternative Chrome wallet extension" },
  ];
}

function getEip1193Wallets(): DetectedWallet[] {
  const eth = (window as { ethereum?: EthereumProvider }).ethereum;
  if (!eth) return [];
  const wallets: DetectedWallet[] = [];
  const seen: Record<string, boolean> = {};
  const providers = eth.providers && Array.isArray(eth.providers) ? eth.providers : [eth];
  for (const p of providers) {
    if (p.isBraveWallet && !seen["Brave"]) {
      seen["Brave"] = true;
      wallets.push({ type: "Brave", label: "Brave Wallet", icon: "🦁", desc: "Brave browser built-in wallet", provider: p });
    } else if ((p.isCoinbaseWallet || p.isCoinbaseBrowser) && !seen["Coinbase"]) {
      seen["Coinbase"] = true;
      wallets.push({ type: "Coinbase", label: "Coinbase Wallet", icon: "🔵", desc: "Coinbase Wallet extension", provider: p });
    } else if (p.isMetaMask && !seen["MetaMask"]) {
      seen["MetaMask"] = true;
      wallets.push({ type: "MetaMask", label: "MetaMask", icon: "🦊", desc: "MetaMask browser extension", provider: p });
    } else if (!seen["BrowserWallet"] && !p.isBraveWallet && !p.isCoinbaseWallet && !p.isMetaMask) {
      seen["BrowserWallet"] = true;
      wallets.push({ type: "BrowserWallet", label: "Browser Wallet", icon: "🌐", desc: "Your connected browser wallet", provider: p });
    }
  }
  return wallets;
}

export function discoverWallets(eip6963Providers: EIP6963ProviderDetail[]): DetectedWallet[] {
  if (eip6963Providers.length > 0) {
    return eip6963Providers.map((detail) => {
      const p = detail.provider;
      let type = detail.info.rdns || detail.info.name;
      let icon = "🌐";
      if (detail.info.name.toLowerCase().includes("metamask")) icon = "🦊";
      else if (detail.info.name.toLowerCase().includes("coinbase")) icon = "🔵";
      else if (detail.info.name.toLowerCase().includes("brave")) icon = "🦁";
      else if (detail.info.icon && detail.info.icon.startsWith("data:image")) icon = "💼";
      return { type, label: detail.info.name, icon, desc: detail.info.rdns || "Browser wallet extension", provider: p };
    });
  }
  return getEip1193Wallets();
}

export async function connectWallet(
  rawProvider: EthereumProvider
): Promise<{ address: string; provider: ethers.providers.Web3Provider; signer: ethers.Signer }> {
  await rawProvider.request({ method: "eth_requestAccounts" });

  try {
    await rawProvider.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: MEGAETH_CHAIN_ID }],
    });
  } catch (switchErr: unknown) {
    const err = switchErr as { code?: number; message?: string };
    if (err && (err.code === 4902 || err.code === -32603)) {
      try {
        await rawProvider.request({
          method: "wallet_addEthereumChain",
          params: [MEGAETH_CONFIG],
        });
      } catch {
        throw new Error("Please add MegaETH network manually (Chain ID: 4326, RPC: https://mainnet.megaeth.com/rpc)");
      }
    } else if (err && err.code !== 4001) {
      console.warn("Could not auto-switch to MegaETH:", err.message);
    } else if (err && err.code === 4001) {
      throw Object.assign(new Error("User rejected network switch"), { code: 4001 });
    }
  }

  const ethProvider = new ethers.providers.Web3Provider(rawProvider as Parameters<typeof ethers.providers.Web3Provider>[0]);
  const signer = ethProvider.getSigner();
  const address = await signer.getAddress();
  return { address, provider: ethProvider, signer };
}
