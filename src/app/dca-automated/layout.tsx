import PrivyProviders from '../../components/PrivyProviders';

export default function AutomatedDCALayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PrivyProviders>{children}</PrivyProviders>;
}