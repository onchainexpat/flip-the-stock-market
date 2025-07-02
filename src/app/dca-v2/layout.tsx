import PrivyProviders from '../../components/PrivyProviders';

export default function DCAv2Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PrivyProviders>{children}</PrivyProviders>;
}
