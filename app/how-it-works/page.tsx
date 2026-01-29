import { redirect } from 'next/navigation';

export const metadata = {
  title: 'How It Works | The Guild Wrestling',
  description:
    'Three simple steps: Meet the Masters, Book Your Session, Watch Them Grow. Learn how The Guild works.',
};

export default function HowItWorksPage() {
  redirect('/#how-it-works');
}
