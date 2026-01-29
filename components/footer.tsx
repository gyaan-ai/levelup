'use client';

import Link from 'next/link';
import { useTenant } from './theme-provider';
import { Instagram, Facebook, Twitter } from 'lucide-react';

export function Footer() {
  const tenant = useTenant();

  return (
    <footer className="bg-primary text-white py-12 mt-auto border-t border-accent/20">
      <div className="container mx-auto px-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 mb-8">
          <div className="md:col-span-1">
            <div className="mb-4">
              <h3 className="text-3xl font-serif font-bold text-accent">
                THE GUILD
              </h3>
              <div className="h-1 w-16 bg-accent mt-2" />
            </div>
            <p className="text-white/80 text-sm mb-2">
              Elite wrestling technique instruction
            </p>
            <p className="text-white/60 text-sm">{tenant.tagline}</p>
          </div>
          <div>
            <h4 className="font-semibold text-lg mb-4 text-accent">
              For Parents
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/browse"
                  className="text-white/80 hover:text-accent transition-colors"
                >
                  Browse Wrestlers
                </Link>
              </li>
              <li>
                <Link
                  href="/how-it-works"
                  className="text-white/80 hover:text-accent transition-colors"
                >
                  How It Works
                </Link>
              </li>
              <li>
                <Link
                  href="/pricing"
                  className="text-white/80 hover:text-accent transition-colors"
                >
                  Pricing
                </Link>
              </li>
              <li>
                <Link
                  href="/faqs"
                  className="text-white/80 hover:text-accent transition-colors"
                >
                  FAQs
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-lg mb-4 text-accent">
              For NCAA Wrestlers
            </h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/signup"
                  className="text-white/80 hover:text-accent transition-colors"
                >
                  Join The Guild
                </Link>
              </li>
              <li>
                <Link
                  href="/requirements"
                  className="text-white/80 hover:text-accent transition-colors"
                >
                  Requirements
                </Link>
              </li>
              <li>
                <Link
                  href="/earnings"
                  className="text-white/80 hover:text-accent transition-colors"
                >
                  Earnings
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-semibold text-lg mb-4 text-accent">Company</h4>
            <ul className="space-y-2 text-sm mb-6">
              <li>
                <Link
                  href="/about"
                  className="text-white/80 hover:text-accent transition-colors"
                >
                  About The Guild
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="text-white/80 hover:text-accent transition-colors"
                >
                  Contact
                </Link>
              </li>
              <li>
                <Link
                  href="/privacy"
                  className="text-white/80 hover:text-accent transition-colors"
                >
                  Privacy
                </Link>
              </li>
              <li>
                <Link
                  href="/terms"
                  className="text-white/80 hover:text-accent transition-colors"
                >
                  Terms
                </Link>
              </li>
            </ul>
            <div className="text-sm">
              <p className="text-white/80 mb-1">{tenant.supportEmail}</p>
              <p className="text-white/80 mb-1">{tenant.phone}</p>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10 pt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <p className="text-sm text-white/60">
              © {new Date().getFullYear()} The Guild. Operated by NC United
              Wrestling.
            </p>
            <div className="flex gap-4">
              <a
                href="#"
                className="text-accent hover:text-accent-hover transition-colors"
                aria-label="Instagram"
              >
                <Instagram className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="text-accent hover:text-accent-hover transition-colors"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5" />
              </a>
              <a
                href="#"
                className="text-accent hover:text-accent-hover transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="w-5 h-5" />
              </a>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}
