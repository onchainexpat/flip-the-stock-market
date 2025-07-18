import PrivyProviders from '../../components/PrivyProviders';

export default function ZeroDevDCALayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PrivyProviders>{children}</PrivyProviders>;
}