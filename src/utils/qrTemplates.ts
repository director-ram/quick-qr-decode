export interface QRTemplate {
  id: string;
  name: string;
  description: string;
  category: 'business' | 'personal' | 'social' | 'utility';
  icon: string;
  dataType: 'text' | 'url' | 'wifi' | 'contact' | 'email' | 'sms';
  preset: {
    // Text/URL preset
    text?: string;
    url?: string;
    // WiFi preset
    wifi?: {
      ssid: string;
      password: string;
      security: 'WPA' | 'WEP' | 'nopass';
    };
    // Contact preset
    contact?: {
      name: string;
      phone: string;
      email: string;
      organization: string;
    };
    // Email preset
    email?: {
      to: string;
      subject: string;
      body: string;
    };
    // SMS preset
    sms?: {
      number: string;
      message: string;
    };
  };
  // Optional styling presets
  styling?: {
    qrColor?: string;
    bgColor?: string;
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    size?: number;
  };
}

export const QR_TEMPLATES: QRTemplate[] = [
  // Business Templates
  {
    id: 'business-website',
    name: 'Business Website',
    description: 'Quick link to your business website',
    category: 'business',
    icon: '🌐',
    dataType: 'url',
    preset: {
      url: 'https://example.com'
    },
    styling: {
      qrColor: '#1f2937',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
      size: 300
    }
  },
  {
    id: 'business-contact',
    name: 'Business Card',
    description: 'Share your business contact information',
    category: 'business',
    icon: '💼',
    dataType: 'contact',
    preset: {
      contact: {
        name: 'Your Name',
        phone: '+1234567890',
        email: 'your.email@example.com',
        organization: 'Your Company'
      }
    },
    styling: {
      qrColor: '#1e40af',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
      size: 300
    }
  },
  {
    id: 'business-wifi',
    name: 'Business WiFi',
    description: 'Share your business WiFi network',
    category: 'business',
    icon: '📶',
    dataType: 'wifi',
    preset: {
      wifi: {
        ssid: 'Business-WiFi',
        password: 'SecurePassword123',
        security: 'WPA'
      }
    },
    styling: {
      qrColor: '#059669',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
      size: 300
    }
  },
  {
    id: 'business-email',
    name: 'Contact Email',
    description: 'Quick email contact QR code',
    category: 'business',
    icon: '📧',
    dataType: 'email',
    preset: {
      email: {
        to: 'contact@example.com',
        subject: 'Inquiry',
        body: 'Hello, I would like to know more about your services.'
      }
    },
    styling: {
      qrColor: '#dc2626',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
      size: 300
    }
  },

  // Personal Templates
  {
    id: 'personal-contact',
    name: 'Personal Contact',
    description: 'Share your personal contact info',
    category: 'personal',
    icon: '👤',
    dataType: 'contact',
    preset: {
      contact: {
        name: 'Your Name',
        phone: '+1234567890',
        email: 'your.email@example.com',
        organization: ''
      }
    },
    styling: {
      qrColor: '#7c3aed',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
      size: 300
    }
  },
  {
    id: 'personal-wifi',
    name: 'Home WiFi',
    description: 'Share your home WiFi network',
    category: 'personal',
    icon: '🏠',
    dataType: 'wifi',
    preset: {
      wifi: {
        ssid: 'Home-WiFi',
        password: 'MySecurePassword',
        security: 'WPA'
      }
    },
    styling: {
      qrColor: '#f59e0b',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
      size: 300
    }
  },
  {
    id: 'personal-url',
    name: 'Personal Link',
    description: 'Link to your portfolio or personal website',
    category: 'personal',
    icon: '🔗',
    dataType: 'url',
    preset: {
      url: 'https://yourwebsite.com'
    },
    styling: {
      qrColor: '#ec4899',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
      size: 300
    }
  },

  // Social Templates
  {
    id: 'social-instagram',
    name: 'Instagram Profile',
    description: 'Link to your Instagram profile',
    category: 'social',
    icon: '📸',
    dataType: 'url',
    preset: {
      url: 'https://instagram.com/yourusername'
    },
    styling: {
      qrColor: '#E4405F',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
      size: 300
    }
  },
  {
    id: 'social-facebook',
    name: 'Facebook Page',
    description: 'Link to your Facebook page',
    category: 'social',
    icon: '👥',
    dataType: 'url',
    preset: {
      url: 'https://facebook.com/yourpage'
    },
    styling: {
      qrColor: '#1877F2',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
      size: 300
    }
  },
  {
    id: 'social-linkedin',
    name: 'LinkedIn Profile',
    description: 'Link to your LinkedIn profile',
    category: 'social',
    icon: '💼',
    dataType: 'url',
    preset: {
      url: 'https://linkedin.com/in/yourprofile'
    },
    styling: {
      qrColor: '#0A66C2',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
      size: 300
    }
  },
  {
    id: 'social-twitter',
    name: 'Twitter/X Profile',
    description: 'Link to your Twitter/X profile',
    category: 'social',
    icon: '🐦',
    dataType: 'url',
    preset: {
      url: 'https://twitter.com/yourusername'
    },
    styling: {
      qrColor: '#1DA1F2',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
      size: 300
    }
  },
  {
    id: 'social-youtube',
    name: 'YouTube Channel',
    description: 'Link to your YouTube channel',
    category: 'social',
    icon: '📺',
    dataType: 'url',
    preset: {
      url: 'https://youtube.com/@yourchannel'
    },
    styling: {
      qrColor: '#FF0000',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
      size: 300
    }
  },

  // Utility Templates
  {
    id: 'utility-sms',
    name: 'Quick SMS',
    description: 'Pre-filled SMS message',
    category: 'utility',
    icon: '💬',
    dataType: 'sms',
    preset: {
      sms: {
        number: '+1234567890',
        message: 'Hello!'
      }
    },
    styling: {
      qrColor: '#10b981',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
      size: 300
    }
  },
  {
    id: 'utility-text',
    name: 'Custom Text',
    description: 'Plain text QR code',
    category: 'utility',
    icon: '📝',
    dataType: 'text',
    preset: {
      text: 'Your custom text here'
    },
    styling: {
      qrColor: '#1f2937',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
      size: 300
    }
  },
  {
    id: 'utility-event-wifi',
    name: 'Event WiFi',
    description: 'WiFi for events and gatherings',
    category: 'utility',
    icon: '🎉',
    dataType: 'wifi',
    preset: {
      wifi: {
        ssid: 'Event-WiFi',
        password: 'Event2024',
        security: 'WPA'
      }
    },
    styling: {
      qrColor: '#8b5cf6',
      bgColor: '#ffffff',
      errorCorrectionLevel: 'M',
      size: 300
    }
  }
];

export function getTemplatesByCategory(category?: QRTemplate['category']): QRTemplate[] {
  if (!category) return QR_TEMPLATES;
  return QR_TEMPLATES.filter(template => template.category === category);
}

export function getTemplateById(id: string): QRTemplate | undefined {
  return QR_TEMPLATES.find(template => template.id === id);
}

