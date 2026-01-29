import { redirect } from 'next/navigation';

export const metadata = {
  title: 'How It Works | The Guild',
  description:
    'Three steps to elite technique mastery: Browse Elite Coaches, Book Private Sessions, Master Your Technique.',
};

export default function HowItWorksPage() {
  redirect('/#how-it-works');
}
