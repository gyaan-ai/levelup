import { redirect } from 'next/navigation';

export const metadata = {
  title: 'How It Works | The Crew Wrestling',
  description:
    'Three simple steps: Find Your Coach, Book Your Session, Put in the Work. Learn how The Crew works.',
};

export default function HowItWorksPage() {
  redirect('/#how-it-works');
}
