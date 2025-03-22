'use client';
import WalletWrapper from './WalletWrapper';

export default function SignupButton() {
  return (
    <WalletWrapper
      className="min-w-[90px] bg-[#1B2335] hover:bg-[#1B2335]/80 !py-2 !px-4 !text-white"
      text="Sign up"
    />
  );
}
