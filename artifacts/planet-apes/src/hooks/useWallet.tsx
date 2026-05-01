import { useState, useEffect, useRef, useCallback } from "react";
import { ethers } from "ethers";
import {
  EIP6963ProviderDetail,
  EthereumProvider,
  DetectedWallet,
  discoverWallets,
  connectWallet,
} from "@/lib/wallet";

interface WalletState {
  address: string | null;
  provider: ethers.providers.Web3Provider | null;
  signer: ethers.Signer | null;
}

export function useWallet(showToast: (msg: string, type?: "success" | "error" | "info") => void) {
  const [wallet, setWallet] = useState<WalletState>({ address: null, provider: null, signer: null });
  const [eip6963Providers, setEip6963Providers] = useState<EIP6963ProviderDetail[]>([]);
  const rawProviderRef = useRef<EthereumProvider | null>(null);

  useEffect(() => {
    const seen = new Set<string>();
    const handleAnnounce = (event: Event) => {
      const detail = (event as CustomEvent<EIP6963ProviderDetail>).detail;
      if (!seen.has(detail.info.uuid)) {
        seen.add(detail.info.uuid);
        setEip6963Providers((prev) => [...prev, detail]);
      }
    };
    window.addEventListener("eip6963:announceProvider", handleAnnounce);
    window.dispatchEvent(new Event("eip6963:requestProvider"));
    return () => window.removeEventListener("eip6963:announceProvider", handleAnnounce);
  }, []);

  const connect = useCallback(
    async (rawProvider: EthereumProvider, label: string) => {
      try {
        showToast(`⏳ Connecting ${label}...`, "info");
        const result = await connectWallet(rawProvider);
        rawProviderRef.current = rawProvider;
        setWallet({ address: result.address, provider: result.provider, signer: result.signer });
        showToast(`✅ ${label} connected! ${result.address.slice(0, 6)}...${result.address.slice(-4)}`, "success");

        const handleAccounts = (accounts: unknown) => {
          const accs = accounts as string[];
          const newAddress = accs && accs[0] ? accs[0] : null;
          if (newAddress) {
            const newProvider = new ethers.providers.Web3Provider(rawProvider as Parameters<typeof ethers.providers.Web3Provider>[0]);
            const newSigner = newProvider.getSigner();
            setWallet({ address: newAddress, provider: newProvider, signer: newSigner });
          } else {
            setWallet({ address: null, provider: null, signer: null });
          }
        };

        rawProvider.on("accountsChanged", handleAccounts);
        rawProvider.on("chainChanged", () => window.location.reload());
      } catch (err: unknown) {
        const e = err as { code?: number; message?: string };
        if (e?.code === 4001 || (e?.message || "").includes("rejected") || (e?.message || "").includes("denied")) {
          showToast("❌ Connection rejected", "error");
        } else {
          showToast(`❌ Connect failed: ${(e?.message || "").slice(0, 80)}`, "error");
        }
      }
    },
    [showToast]
  );

  const disconnect = useCallback(() => {
    setWallet({ address: null, provider: null, signer: null });
    rawProviderRef.current = null;
  }, []);

  const getWallets = useCallback((): DetectedWallet[] => {
    return discoverWallets(eip6963Providers);
  }, [eip6963Providers]);

  return { wallet, connect, disconnect, getWallets };
}
