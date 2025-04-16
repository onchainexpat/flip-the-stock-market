'use client';
import WalletWrapper from './WalletWrapper';

type LoginButtonProps = {
  text?: string;
  className?: string;
};

export default function LoginButton({ text = "Log in", className = "min-w-[90px]" }: LoginButtonProps) {
  return (
    <WalletWrapper
      className={className}
      text={text}
      withWalletAggregator={true}
    />
  );
}
