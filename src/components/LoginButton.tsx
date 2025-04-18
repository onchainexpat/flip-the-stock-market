'use client';
import { useConnectModal } from '@rainbow-me/rainbowkit';

export default function LoginButton() {
  const { openConnectModal } = useConnectModal();

  return (
    <button
      onClick={openConnectModal}
      className="min-w-[120px] bg-[#1B2335] hover:bg-[#1B2335]/80 py-2 px-4 text-white rounded-lg"
    >
      Log in
    </button>
  );
}
