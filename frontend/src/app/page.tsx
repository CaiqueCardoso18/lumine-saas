// Redireciona / → /dashboard (o middleware cuida do auth)
import { redirect } from 'next/navigation';

export default function RootPage() {
  redirect('/dashboard');
}
