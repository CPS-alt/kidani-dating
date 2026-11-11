import { useEffect, useRef, useState } from 'react';
import { AuthCard } from './components/AuthCard';
import {
  getConversations,
  getCurrentProfile,
  getMessages,
  getProfiles,
  interactWithProfile,
  saveProfile,
  sendMessage as sendMessageToServer,
  signIn,
  signOut,
  signUp,
} from './services/backend';
import type { AuthMode, LocalMessage, MatchProfile, UserProfile } from './types';

type Tab = 'discover' | 'messages' | 'wallet' | 'settings';
type Language = 'en' | 'sw';
type ServiceListing = { id: string; name: string; amount: number };

const translations = {
  en: {
    discover: 'Discover',
    messages: 'Messages',
    wallet: 'Kifurushi',
    settings: 'Settings',
    picks: "TODAY'S PICKS",
    title: 'Meet someone who feels like you.',
    subtitle: 'A thoughtful connection could be one hello away.',
    online: 'Show me in discovery',
    onlineNote: 'Your profile is visible to eligible Kidani members.',
    offlineNote: 'Your profile is hidden from new recommendations.',
    match: 'YOUR DAILY INTRODUCTION',
    likes: 'Send interest',
    skip: 'Next profile',
    boost: 'JIBOOST',
    verified: 'Community profile',
    distance: 'Nearby',
    historyTitle: 'Your activity',
    historySubtitle: 'Keep up with the connections you are building.',
    emptyHistory: 'Your introductions will show up here.',
    walletTitle: 'Choose your Kidani Kifurushi',
    walletSubtitle: 'Choose a membership to get more from Kidani.',
    choose: 'Choose membership',
    selected: 'Selected',
    demoPayment: 'Manual mobile-money payment. Kidani does not verify payments automatically yet.',
    profileTitle: 'Your settings',
    support: 'Here for you',
    language: 'Language',
    save: 'Save changes',
  },
  sw: {
    discover: 'Gundua',
    messages: 'Messages',
    wallet: 'Kifurushi',
    settings: 'Mipangilio',
    picks: 'MAPENDEKEZO YA LEO',
    title: 'Kutana na mtu anayekuelewa.',
    subtitle: 'Uhusiano wa maana unaweza kuanza kwa salamu moja.',
    online: 'Nionyeshe kwenye Gundua',
    onlineNote: 'Wasifu wako unaonekana kwa wanachama wanaostahili.',
    offlineNote: 'Wasifu wako umefichwa kwenye mapendekezo mapya.',
    match: 'UTAMBULISHO WAKO WA LEO',
    likes: 'Tuma salamu',
    skip: 'Wasifu unaofuata',
    boost: 'JIBOOST',
    verified: 'Wasifu wa jamii',
    distance: 'Karibu nawe',
    historyTitle: 'Shughuli zako',
    historySubtitle: 'Fuatilia mahusiano unayojenga.',
    emptyHistory: 'Utambulisho wako utaonekana hapa.',
    walletTitle: 'Chagua Kifurushi chako cha Kidani',
    walletSubtitle: 'Chagua uanachama ili upate mengi zaidi Kidani.',
    choose: 'Chagua uanachama',
    selected: 'Umechagua',
    demoPayment: 'Malipo ya simu yanafanywa mwenyewe. Kidani bado haithibitishi malipo moja kwa moja.',
    profileTitle: 'Mipangilio yako',
    support: 'Tuko hapa kukusaidia',
    language: 'Lugha',
    save: 'Hifadhi mabadiliko',
  },
} as const;

const membershipPlans = [
  {
    id: 'elite',
    name: 'Kidani Elite',
    duration: '2 weeks · Siku 14',
    price: 'TZS 13,000',
    features: ['Boost ya kawaida kila dakika 30', 'Hadi boosts 96 kwa siku'],
  },
  {
    id: 'premium',
    name: 'Kidani Premium',
    duration: '1 month · Siku 30',
    price: 'TZS 21,000',
    features: ['Boost za haraka na mwonekano wa kipaumbele', 'Boosts hadi 96/siku — otomatiki na wewe mwenyewe'],
  },
];

const mobileMoneyNumber = '0792653065';
const paymentRecipient = 'HILLARY MHAGAMA';
const supportNumber = '0792653065';

const serviceOptions = [
  { id: 'sim1', name: 'Sim 1 (bei kuu)', amount: 100000 },
  { id: 'sim2', name: 'Sim 2', amount: 200000 },
  { id: 'massage', name: 'Massage', amount: 120000 },
  { id: 'video-call', name: 'Video Call', amount: 20000 },
  { id: 'date', name: 'Coffee date', amount: 30000 },
  { id: 'video-chat', name: 'Video call', amount: 20000 },
];

function readSetting(key: string, fallback: string) {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch (error) {
    console.error(`Unable to read ${key} from local storage.`, error);
    return fallback;
  }
}

function readStringArraySetting(key: string): string[] {
  const raw = readSetting(key, '[]');
  try {
    const value: unknown = JSON.parse(raw);
    return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
  } catch (error) {
    console.error(`Unable to parse ${key} from local storage.`, error);
    return [];
  }
}

function isValidPhoneNumber(phoneNumber: string) {
  const digitCount = phoneNumber.replace(/\D/g, '').length;
  return digitCount >= 9 && digitCount <= 15;
}

function getProfilePhotoSource(profile: MatchProfile) {
  return profile.profilePhoto
    || (profile.hasProfilePhoto ? `/api/profiles/${encodeURIComponent(profile.id)}/photo` : '');
}

function App() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('discover');
  const [directoryProfiles, setDirectoryProfiles] = useState<MatchProfile[]>([]);
  const [conversations, setConversations] = useState<MatchProfile[]>([]);
  const [selectedDiscoveryProfileId, setSelectedDiscoveryProfileId] = useState('');
  const [selectedProfileDetails, setSelectedProfileDetails] = useState<MatchProfile | null>(null);
  const [dislikedProfileIds, setDislikedProfileIds] = useState(() => readStringArraySetting('kidani-disliked-profiles'));
  const [isDislikingProfile, setIsDislikingProfile] = useState(false);
  const [online, setOnline] = useState(readSetting('kidani-online', 'true') === 'true');
  const [language, setLanguage] = useState<Language>(
    readSetting('kidani-language', 'en') === 'sw' ? 'sw' : 'en',
  );
  const [selectedPlan, setSelectedPlan] = useState(readSetting('kidani-plan', ''));
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [boostCount, setBoostCount] = useState(Number(readSetting('kidani-boost-count', '0')) || 0);
  const [accountType, setAccountType] = useState<'woman' | 'man' | 'gay'>('woman');
  const [whatsappNumber, setWhatsappNumber] = useState('');
  const [callNumber, setCallNumber] = useState('');
  const [paymentPhone, setPaymentPhone] = useState('');
  const [services, setServices] = useState<ServiceListing[]>([]);
  const [newServiceId, setNewServiceId] = useState('');
  const [newServiceAmount, setNewServiceAmount] = useState('');
  const [gpsStatus, setGpsStatus] = useState('');
  const [profilePhoto, setProfilePhoto] = useState('');
  const [viewOnce, setViewOnce] = useState(readSetting('kidani-view-once', 'false') === 'true');
  const [verificationPhoto, setVerificationPhoto] = useState('');
  const [verificationStatus, setVerificationStatus] = useState('not-started');
  const [cameraOpen, setCameraOpen] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const videoRef = useRef<HTMLVideoElement>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const dislikeTimerRef = useRef<number | null>(null);
  const [notice, setNotice] = useState('');
  const [messages, setMessages] = useState<LocalMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [authForm, setAuthForm] = useState({
    name: '',
    email: '',
    password: '',
    location: 'Nairobi',
    age: '',
    phoneNumber: '',
  });
  const [draft, setDraft] = useState(() => ({
    name: '',
    age: '',
    location: '',
    bio: '',
    hobbies: '',
    lookingFor: '',
  }));
  const copy = translations[language];
  const visibleDiscoveryProfiles = directoryProfiles;
  const availableDiscoveryProfiles = visibleDiscoveryProfiles.filter((match) => !dislikedProfileIds.includes(match.id));
  const discoveryProfile = availableDiscoveryProfiles[0] ?? null;
  const selectedDiscoveryProfile = selectedProfileDetails?.id === selectedDiscoveryProfileId ? selectedProfileDetails : null;
  const permittedConversationProfiles = conversations;
  const interactedMatches = conversations;
  const activeConversation = permittedConversationProfiles.find((match) => match.id === activeConversationId) ?? null;
  const conversationMessages = messages.filter((message) => message.matchId === activeConversation?.id);

  const applyProfile = (member: UserProfile) => {
    setProfile(member);
    setAccountType(member.accountType === 'man' || member.accountType === 'gay' ? member.accountType : 'woman');
    setPaymentPhone(member.phoneNumber ?? '');
    setWhatsappNumber(member.whatsappNumber ?? '');
    setCallNumber(member.callNumber ?? '');
    setServices(member.services ?? []);
    setProfilePhoto(member.profilePhoto ?? '');
    setOnline(member.online !== false);
    setDraft({
      name: member.name,
      age: String(member.age),
      location: member.location,
      bio: member.bio,
      hobbies: member.hobbies.join(', '),
      lookingFor: member.lookingFor,
    });
  };

  const refreshAccountData = async () => {
    const [nextProfiles, nextConversations] = await Promise.all([getProfiles(), getConversations()]);
    setDirectoryProfiles(nextProfiles);
    setConversations(nextConversations);
  };

  const buildProfileUpdate = (overrides: Partial<Parameters<typeof saveProfile>[0]> = {}) => ({
    name: draft.name || profile?.name || '',
    age: Number(draft.age || profile?.age || 0),
    location: draft.location || profile?.location || '',
    bio: draft.bio,
    phoneNumber: paymentPhone,
    whatsappNumber,
    callNumber,
    services,
    profilePhoto: profilePhoto || null,
    online,
    ...overrides,
  });

  useEffect(() => {
    let cancelled = false;
    const restoreSession = async () => {
      try {
        const member = await getCurrentProfile();
        if (cancelled) return;
        if (member) {
          applyProfile(member);
          await refreshAccountData();
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Unable to restore the Kidani session.', error);
          setNotice(error instanceof Error ? error.message : 'Unable to connect to Kidani.');
        }
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    };
    void restoreSession();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!profile) return;
    let cancelled = false;
    const refresh = async () => {
      try {
        const nextConversations = await getConversations();
        if (!cancelled) setConversations(nextConversations);
      } catch (error) {
        if (!cancelled) console.error('Unable to refresh Kidani conversations.', error);
      }
    };
    const timerId = window.setInterval(() => { void refresh(); }, 5000);
    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [profile?.id]);

  useEffect(() => {
    if (!profile || !activeConversationId) {
      setMessages([]);
      return;
    }
    let cancelled = false;
    const refresh = async () => {
      try {
        const latestMessages = await getMessages(activeConversationId);
        if (!cancelled) setMessages(latestMessages);
      } catch (error) {
        if (!cancelled) {
          console.error('Unable to load Kidani conversation messages.', error);
          setNotice(error instanceof Error ? error.message : 'Unable to load messages.');
        }
      }
    };
    void refresh();
    const timerId = window.setInterval(() => { void refresh(); }, 3000);
    return () => {
      cancelled = true;
      window.clearInterval(timerId);
    };
  }, [profile?.id, activeConversationId]);

  useEffect(() => () => {
    if (dislikeTimerRef.current !== null) {
      window.clearTimeout(dislikeTimerRef.current);
    }
  }, []);

  useEffect(() => {
    window.localStorage.removeItem('kidani-package-ends-at');
  }, []);

  useEffect(() => {
    try {
      const legacyKeys = [
        'kidani-profile',
        'kidani-session-status',
        'kidani-messages',
        'kidani-interests',
        'kidani-photo',
        'kidani-verification-photo',
        'kidani-verification-status',
        'kidani-service-list',
        'kidani-whatsapp',
        'kidani-call-number',
      ];
      const hadLocalAccount = window.localStorage.getItem('kidani-profile') !== null;
      legacyKeys.forEach((key) => window.localStorage.removeItem(key));
      if (hadLocalAccount) {
        setNotice('Kidani now uses shared accounts. Your old browser-only preview account was not transferred; please create a new account.');
      }
    } catch (error) {
      console.error('Unable to remove legacy browser-only account data.', error);
      setNotice('Old browser-only data could not be cleared. Please clear this browser’s Kidani site data before continuing.');
    }
  }, []);

  useEffect(() => {
    if (!cameraOpen) {
      return;
    }

    let cancelled = false;
    const openCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        setCameraError('');
      } catch (error) {
        console.error('Unable to access the camera for photo verification.', error);
        setCameraError('Camera access was unavailable. Allow camera permission or upload a verification photo instead.');
      }
    };

    void openCamera();
    return () => {
      cancelled = true;
      cameraStreamRef.current?.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    };
  }, [cameraOpen]);

  const handleAuthSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    try {
      if (authMode === 'signup') {
        const age = Number(authForm.age);
        if (!authForm.name.trim() || !authForm.email.trim() || !authForm.password || !authForm.location.trim()
          || !Number.isInteger(age) || age < 18 || age > 120 || !isValidPhoneNumber(authForm.phoneNumber)) {
          setNotice('Add your name, email, password, city, a valid age of 18 or older, and a valid M-Pesa phone number.');
          return;
        }
        const member = await signUp({
          name: authForm.name.trim(),
          email: authForm.email.trim(),
          password: authForm.password,
          age,
          location: authForm.location.trim(),
          phoneNumber: authForm.phoneNumber.trim(),
          accountType,
        });
        applyProfile(member);
        setNotice('Your Kidani profile is ready.');
      } else {
        const member = await signIn(authForm.email, authForm.password);
        applyProfile(member);
        setNotice(`Welcome back, ${member.name}.`);
      }
      setActiveTab('discover');
      setAuthForm((previous) => ({ ...previous, password: '' }));
      await refreshAccountData();
    } catch (error) {
      console.error('Kidani sign-in or account creation failed.', error);
      setNotice(error instanceof Error ? error.message : 'Unable to access Kidani. Please try again.');
    }
  };

  const openProfileDetails = async (match: MatchProfile) => {
    if (!profile) {
      setNotice('Create an account in Settings to send interest.');
      setActiveTab('settings');
      return;
    }
    try {
      const details = await interactWithProfile(match.id);
      setSelectedProfileDetails(details);
      setSelectedDiscoveryProfileId(details.id);
      const nextConversations = await getConversations();
      setConversations(nextConversations);
      setNotice('');
    } catch (error) {
      console.error('Unable to open the Kidani profile.', error);
      setNotice(error instanceof Error ? error.message : 'Unable to open this profile.');
    }
  };

  const sendInterest = async (match: MatchProfile) => {
    try {
      await interactWithProfile(match.id);
      setConversations(await getConversations());
      setNotice(`Your hello to ${match.name} has been sent.`);
    } catch (error) {
      console.error('Unable to send interest on Kidani.', error);
      setNotice(error instanceof Error ? error.message : 'Unable to send interest.');
    }
  };

  const saveProfileDraft = async () => {
    const parsedAge = Number(draft.age);
    if (!Number.isInteger(parsedAge) || parsedAge < 18 || parsedAge > 120) {
      setNotice('Enter a valid age of 18 or older before saving.');
      return;
    }
    if (!draft.name.trim() || !draft.location.trim() || (accountType === 'man' && !draft.bio.trim())) {
      setNotice(accountType === 'man'
        ? 'Please fill in your name, location, and bio before saving.'
        : 'Please fill in your name and location before saving.');
      return;
    }
    if (!isValidPhoneNumber(paymentPhone)) {
      setNotice('Add a valid M-Pesa phone number before saving your profile.');
      return;
    }
    try {
      const member = await saveProfile(buildProfileUpdate({
        name: draft.name.trim(),
        age: parsedAge,
        location: draft.location.trim(),
        phoneNumber: paymentPhone.trim(),
      }));
      applyProfile(member);
      window.localStorage.setItem('kidani-view-once', String(viewOnce));
      setNotice('Your profile changes have been saved to Kidani.');
      await refreshAccountData();
    } catch (error) {
      console.error('Unable to save the Kidani profile.', error);
      setNotice(error instanceof Error ? error.message : 'Unable to save your profile.');
    }
  };

  const toggleOnline = async () => {
    const nextValue = !online;
    setOnline(nextValue);
    try {
      const member = await saveProfile(buildProfileUpdate({ online: nextValue }));
      applyProfile(member);
      await refreshAccountData();
    } catch (error) {
      setOnline(!nextValue);
      console.error('Unable to update Kidani profile visibility.', error);
      setNotice(error instanceof Error ? error.message : 'Unable to update profile visibility.');
    }
  };

  const chooseLanguage = (nextLanguage: Language) => {
    setLanguage(nextLanguage);
    window.localStorage.setItem('kidani-language', nextLanguage);
  };

  const choosePlan = (planId: string) => {
    setSelectedPlan(planId);
    setCheckoutOpen(true);
    window.localStorage.setItem('kidani-plan', planId);
    setNotice('Review the package and recipient details below, then continue to M-Pesa on your phone.');
    window.requestAnimationFrame(() => {
      document.getElementById('payment-guide')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  };

  const activateBoost = () => {
    const nextCount = boostCount + 1;
    setBoostCount(nextCount);
    window.localStorage.setItem('kidani-boost-count', String(nextCount));
    setNotice('JIBOOST demo activated locally. Real profile boosts require a connected service.');
  };

  const addService = () => {
    const service = serviceOptions.find((option) => option.id === newServiceId);
    const amount = Number(newServiceAmount);
    if (!service || !Number.isFinite(amount) || amount <= 0) {
      setNotice('Choose a service and enter an amount greater than zero TSH.');
      return;
    }

    const nextServices = [...services, { id: crypto.randomUUID(), name: service.name, amount }];
    setServices(nextServices);
    setNewServiceId('');
    setNewServiceAmount('');
    setNotice(`${service.name} added to your service list.`);
  };

  const updateServiceAmount = (serviceId: string, value: string) => {
    const amount = value === '' ? 0 : Number(value);
    if (!Number.isFinite(amount) || amount < 0) {
      return;
    }
    const nextServices = services.map((service) => service.id === serviceId ? { ...service, amount } : service);
    setServices(nextServices);
  };

  const removeService = (serviceId: string) => {
    const nextServices = services.filter((service) => service.id !== serviceId);
    setServices(nextServices);
  };

  const updateGpsLocation = () => {
    if (!navigator.geolocation) {
      setGpsStatus('GPS is not available in this browser.');
      return;
    }
    setGpsStatus('Requesting location permission…');
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const nextLocation = `${coords.latitude.toFixed(4)}, ${coords.longitude.toFixed(4)}`;
        setDraft((previous) => ({ ...previous, location: nextLocation }));
        setGpsStatus(`Location updated: ${nextLocation}. Save profile to keep this location.`);
      },
      (error) => {
        const message = error.code === error.PERMISSION_DENIED
          ? 'Location permission was denied. You can still enter your city manually.'
          : 'Unable to get your location. Please try again or enter your city manually.';
        setGpsStatus(message);
      },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const handleProfilePhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setNotice('Choose a JPEG, PNG, or WebP image for your profile photo.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice('Choose an image smaller than 2 MB to upload.');
      return;
    }
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        const image = new Image();
        image.onerror = () => setNotice('The selected photo could not be opened. Please try another image.');
        image.onload = async () => {
          const scale = Math.min(1, 960 / Math.max(image.naturalWidth, image.naturalHeight));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
          canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
          const context = canvas.getContext('2d');
          if (!context) {
            setNotice('The selected photo could not be prepared. Please try another image.');
            return;
          }
          context.drawImage(image, 0, 0, canvas.width, canvas.height);
          const compressedPhoto = canvas.toDataURL('image/jpeg', 0.76);
          if (compressedPhoto.length > 700_000) {
            setNotice('This photo could not be reduced enough to upload. Please choose another image.');
            return;
          }
        try {
          const member = await saveProfile(buildProfileUpdate({ profilePhoto: compressedPhoto }));
          applyProfile(member);
          setNotice('Profile photo saved to Kidani.');
        } catch (error) {
          console.error('Unable to save the Kidani profile photo.', error);
          setNotice(error instanceof Error ? error.message : 'The photo could not be saved. Try a smaller image.');
        }
        };
        image.src = reader.result;
      }
    };
    reader.onerror = () => {
      setNotice('The selected photo could not be opened. Please try another image.');
    };
    reader.readAsDataURL(file);
  };

  const removeProfilePhoto = async () => {
    try {
      const member = await saveProfile(buildProfileUpdate({ profilePhoto: null }));
      applyProfile(member);
      setNotice('Profile photo removed.');
    } catch (error) {
      console.error('Unable to remove the Kidani profile photo.', error);
      setNotice(error instanceof Error ? error.message : 'Unable to remove the profile photo.');
    }
  };

  const handleVerificationPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    if (!file.type.startsWith('image/')) {
      setNotice('Please choose a photo image for verification.');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      setNotice('Choose a verification image smaller than 2 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        return;
      }
      setVerificationPhoto(reader.result);
      setVerificationStatus('pending');
      setNotice('Verification photo is held in this browser session only; it is not sent to Kidani for admin review yet.');
    };
    reader.onerror = () => setNotice('The verification photo could not be read. Please try another image.');
    reader.readAsDataURL(file);
  };

  const captureVerificationPhoto = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || video.videoHeight === 0) {
      setCameraError('Camera is not ready yet. Please wait a moment and try again.');
      return;
    }

    const canvas = document.createElement('canvas');
    const scale = Math.min(1, 960 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    const context = canvas.getContext('2d');
    if (!context) {
      setCameraError('Could not capture the camera image. Please try uploading a photo.');
      return;
    }

    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photo = canvas.toDataURL('image/jpeg', 0.78);
    setVerificationPhoto(photo);
    setVerificationStatus('pending');
    setCameraOpen(false);
    setNotice('Verification photo is held in this browser session only; it is not sent to Kidani for admin review yet.');
  };

  const sendMessage = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const text = messageDraft.trim();
    if (!activeConversation || !text) {
      return;
    }
    try {
      const sentMessage = await sendMessageToServer(activeConversationId, text);
      setMessages((previous) => [...previous, sentMessage]);
      setMessageDraft('');
      setConversations(await getConversations());
    } catch (error) {
      console.error('Unable to send the Kidani message.', error);
      setNotice(error instanceof Error ? error.message : 'Unable to send this message.');
    }
  };

  const dislikeDiscoveryProfile = () => {
    if (!discoveryProfile || dislikeTimerRef.current !== null) {
      return;
    }

    setIsDislikingProfile(true);
    dislikeTimerRef.current = window.setTimeout(() => {
      const next = [...new Set([...dislikedProfileIds, discoveryProfile.id])];
      try {
        window.localStorage.setItem('kidani-disliked-profiles', JSON.stringify(next));
      } catch (error) {
        console.error('Unable to save disliked Kidani profiles.', error);
        setNotice('This profile was skipped, but your choice could not be saved on this device.');
      }
      setDislikedProfileIds(next);
      setIsDislikingProfile(false);
      dislikeTimerRef.current = null;
    }, 260);
  };

  const resetDislikedProfiles = () => {
    try {
      window.localStorage.removeItem('kidani-disliked-profiles');
    } catch (error) {
      console.error('Unable to reset disliked Kidani profiles.', error);
      setNotice('Profiles were restored for now, but this change could not be saved on this device.');
    }
    setDislikedProfileIds([]);
  };

  const copyContactValue = async (label: string, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setNotice(`${label} copied.`);
    } catch (error) {
      console.error(`Unable to copy the ${label.toLowerCase()}.`, error);
      setNotice(`Could not copy the ${label.toLowerCase()}. Please select and copy it manually.`);
    }
  };

  const openConversation = (matchId: string) => {
    if (!permittedConversationProfiles.some((match) => match.id === matchId)) {
      setNotice('This profile is not available for your account.');
      return;
    }
    setActiveConversationId(matchId);
    setActiveTab('messages');
    setNotice('');
  };

  const selectTab = (tab: Tab) => {
    if (tab === 'wallet' && accountType === 'man') {
      return;
    }
    setActiveTab(tab);
    setNotice('');
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      setProfile(null);
      setDirectoryProfiles([]);
      setConversations([]);
      setMessages([]);
      setAuthMode('login');
      setActiveConversationId('');
      setSelectedDiscoveryProfileId('');
      setSelectedProfileDetails(null);
      setAuthForm((previous) => ({ ...previous, password: '' }));
      setNotice('');
    } catch (error) {
      console.error('Unable to sign out of Kidani.', error);
      setNotice(error instanceof Error ? error.message : 'Unable to sign out. Please try again.');
    }
  };

  if (authLoading) {
    return (
      <div className="app-backdrop auth-backdrop">
        <main className="auth-page" aria-live="polite">
          <a className="auth-brand" href="#home" aria-label="Kidani home"><span className="auth-brand-mark">K</span><span>Kidani</span></a>
          <p className="auth-local-note">Connecting securely to Kidani…</p>
        </main>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="app-backdrop auth-backdrop">
        <main className="auth-page">
          <a className="auth-brand" href="#home" aria-label="Kidani home">
            <span className="auth-brand-mark">K</span>
            <span>Kidani</span>
          </a>
          <div className="auth-welcome">
            <span className="auth-welcome-icon" aria-hidden="true">✦</span>
            <p className="eyebrow">REAL CONNECTION, AT YOUR PACE</p>
            <h1>{authMode === 'login' ? 'Login' : 'Your next chapter starts here.'}</h1>
            <p>{authMode === 'login'
              ? 'Sign in to pick up where your connections left off.'
              : 'Create your profile and meet people looking for something real.'}</p>
          </div>
          {notice ? <div className="notice-banner auth-notice" role="alert">{notice}</div> : null}
          <AuthCard
            authMode={authMode}
            authForm={authForm}
            accountType={accountType}
            onAccountTypeChange={setAccountType}
            onChange={(field, value) => setAuthForm((previous) => ({ ...previous, [field]: value }))}
            onSubmit={handleAuthSubmit}
            onToggleMode={() => {
              setAuthMode((mode) => mode === 'signup' ? 'login' : 'signup');
              setNotice('');
            }}
          />
          <p className="auth-local-note">{authMode === 'signup'
            ? 'Your account details are stored on Kidani. Your photo, location, and services are visible to eligible members while you are discoverable. Your M-Pesa number stays private; call and WhatsApp numbers you add are shared after you interact.'
            : 'Your password is protected with a one-way hash. Keep it private and use respectful messages.'}</p>
          <p className="settings-footer">Kidani · Real connection, at your pace.</p>
        </main>
      </div>
    );
  }

  return (
    <div className="app-backdrop">
      <div className="app-frame">
        <header className="app-header">
          <a className="brand" href="#home" onClick={(event) => { event.preventDefault(); selectTab('discover'); }}>
            <span className="brand-mark">K</span>
            <span>Kidani</span>
          </a>
          <button
            type="button"
            className="icon-button notification-button"
            aria-label="Notifications"
            onClick={() => selectTab('messages')}
          >
            <svg aria-hidden="true" viewBox="0 0 24 24">
              <path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" />
              <path d="M10 21h4" />
            </svg>
            {interactedMatches.length > 0 ? <i /> : null}
          </button>
        </header>

        <main className="app-content">
          {notice ? <div className="notice-banner" role="status">{notice}</div> : null}

          {activeTab === 'discover' ? (
            accountType !== 'man' ? (
              <section className="discover-view woman-discover">
                <div className="page-intro">
                  <p className="eyebrow">GUNDUA · YOUR PROFILE</p>
                  <h1>My profile</h1>
                </div>
                <article className="own-profile-card">
                  <div className="own-profile-photo">
                    {profilePhoto
                      ? <img src={profilePhoto} alt={`${profile.name}'s profile`} />
                      : <span aria-label="Profile photo not uploaded">{profile.avatar}</span>}
                  </div>
                  <div className="own-profile-heading">
                    <h2>{profile.name}, {profile.age}</h2>
                  </div>
                  <dl className="profile-facts">
                    <div><dt>Gender</dt><dd>{accountType === 'woman' ? 'Woman' : 'Gay'}</dd></div>
                    <div><dt>Location</dt><dd>{draft.location || profile.location}</dd></div>
                  </dl>
                  <section className="profile-service-display">
                    <h3>Huduma / Services provided</h3>
                    {services.length ? (
                      <div className="public-service-list">
                        {services.map((service) => (
                          <div key={service.id}><span>{service.name}</span><strong>{service.amount.toLocaleString()} TSH</strong></div>
                        ))}
                      </div>
                    ) : <p>No services added yet.</p>}
                  </section>
                  <button type="button" className="secondary-action own-profile-edit" onClick={() => setActiveTab('settings')}>Edit profile</button>
                </article>
              </section>
            ) : (
              <section className="discover-view man-discover">
                {selectedDiscoveryProfile ? (
                  <>
                    <button type="button" className="back-to-profiles" onClick={() => setSelectedDiscoveryProfileId('')}>← Back to profiles</button>
                    <article className="woman-detail-card">
                      <div className="woman-detail-photo">
                        {getProfilePhotoSource(selectedDiscoveryProfile)
                          ? <img src={getProfilePhotoSource(selectedDiscoveryProfile)} alt={`${selectedDiscoveryProfile.name}'s profile`} />
                          : <span className="profile-image-placeholder">{selectedDiscoveryProfile.avatar}</span>}
                        <div className="photo-shade" />
                        <div className="woman-detail-caption">
                          <h1>{selectedDiscoveryProfile.name}, {selectedDiscoveryProfile.age}</h1>
                          <p>{selectedDiscoveryProfile.location} · {selectedDiscoveryProfile.gender === 'woman' ? 'Woman' : 'Gay'}</p>
                        </div>
                      </div>
                      <div className="woman-detail-content">
                        <section className="contact-details">
                          <h2>Contact</h2>
                          <div className="contact-detail-row">
                            <span>Mobile number</span>
                            {selectedDiscoveryProfile.mobileNumber
                              ? <><a href={`tel:${selectedDiscoveryProfile.mobileNumber}`}>{selectedDiscoveryProfile.mobileNumber}</a><button type="button" className="outline-action" onClick={() => void copyContactValue('Mobile number', selectedDiscoveryProfile.mobileNumber!)}>Copy</button></>
                              : <strong className="contact-unavailable">Not shared</strong>}
                          </div>
                          <div className="contact-detail-row">
                            <span>WhatsApp</span>
                            {selectedDiscoveryProfile.whatsappNumber
                              ? <><a href={`https://wa.me/${selectedDiscoveryProfile.whatsappNumber.replace(/\D/g, '')}`} target="_blank" rel="noreferrer">Message on WhatsApp</a><button type="button" className="outline-action" onClick={() => void copyContactValue('WhatsApp number', selectedDiscoveryProfile.whatsappNumber!)}>Copy</button></>
                              : <strong className="contact-unavailable">Not shared</strong>}
                          </div>
                        </section>
                        <section className="profile-service-display">
                          <h2>Huduma / Services provided</h2>
                          {selectedDiscoveryProfile.services?.length ? (
                            <>
                              <div className="public-service-list">
                                {selectedDiscoveryProfile.services.map((service) => (
                                  <div key={service.name}><span>{service.name}</span><strong>{service.amount.toLocaleString()} TSH</strong></div>
                                ))}
                              </div>
                            </>
                          ) : <p>No services listed.</p>}
                        </section>
                        <div className="woman-profile-actions">
                          <button type="button" className="primary-action" onClick={() => openConversation(selectedDiscoveryProfile.id)}>
                            {selectedDiscoveryProfile.gender === 'woman' ? 'TEXT HER' : 'TEXT THEM'}
                          </button>
                          <button type="button" className="secondary-action" onClick={() => sendInterest(selectedDiscoveryProfile)}>Send interest</button>
                        </div>
                        <p className="local-message-note">Messages are delivered through Kidani. Keep conversations respectful and never share your M-Pesa PIN.</p>
                      </div>
                    </article>
                  </>
                ) : (
                  <>
                    <div className="online-strip">
                      <span className={online ? 'online-dot' : 'online-dot offline'} />
                      <div className="online-copy">
                        <strong>{online ? 'Discover profiles on Kidani' : 'You are hidden from discovery'}</strong>
                        <span>{online ? 'View one profile at a time. Interact to see their details or dislike to move on.' : copy.offlineNote}</span>
                      </div>
                      <button type="button" className={online ? 'switch is-on' : 'switch'} role="switch" aria-checked={online} aria-label={copy.online} onClick={toggleOnline}><span /></button>
                    </div>
                    <div className="page-intro">
                      <p className="eyebrow">{copy.picks}</p>
                      <h1>Discover profiles</h1>
                      <p>One profile at a time. Choose who you would like to know.</p>
                    </div>
                    {discoveryProfile ? (
                      <article key={discoveryProfile.id} className={isDislikingProfile ? 'discovery-swipe-card is-disliking' : 'discovery-swipe-card'}>
                        <button type="button" className="discovery-profile-open" onClick={() => void openProfileDetails(discoveryProfile)} aria-label={`Interact with ${discoveryProfile.name}`}>
                          {getProfilePhotoSource(discoveryProfile)
                            ? <img src={getProfilePhotoSource(discoveryProfile)} alt={`${discoveryProfile.name}'s profile`} />
                            : <span className="profile-image-placeholder">{discoveryProfile.avatar}</span>}
                          <span className="discovery-profile-shade" />
                          <span className="discovery-profile-label">
                            <small>{discoveryProfile.gender === 'woman' ? 'WOMAN' : 'GAY'} · {discoveryProfile.location}</small>
                            <strong>{discoveryProfile.name}, {discoveryProfile.age}</strong>
                          </span>
                        </button>
                        <div className="discovery-profile-actions">
                          <button type="button" className="dislike-profile-button" onClick={dislikeDiscoveryProfile} disabled={isDislikingProfile}>DISLIKE</button>
                          <button type="button" className="interact-profile-button" onClick={() => void openProfileDetails(discoveryProfile)}>INTERACT</button>
                        </div>
                      </article>
                    ) : (
                      <div className="empty-state">
                        <span className="empty-icon" aria-hidden="true">♡</span>
                        <h2>You have seen all profiles</h2>
                        <p>New profiles will appear here as more people join Kidani.</p>
                        <button type="button" className="primary-action" onClick={resetDislikedProfiles}>Show profiles again</button>
                      </div>
                    )}
                    <p className="demo-listing-note">Profiles are shared with signed-in members according to their account type and visibility settings.</p>
                    {accountType !== 'man' ? (
                      <button type="button" className="boost-banner" onClick={() => setActiveTab('wallet')}>
                        <span className="boost-icon" aria-hidden="true">✦</span>
                        <span><strong>{copy.boost}</strong><small>Boost your profile and reach more people</small></span>
                        <span className="boost-arrow" aria-hidden="true">→</span>
                      </button>
                    ) : null}
                  </>
                )}
              </section>
            )
          ) : null}

          {activeTab === 'messages' ? (
            <section className="tab-view messages-view">
              <div className="page-intro">
                <p className="eyebrow">KIDANI CONNECTIONS</p>
                <h1>Messages</h1>
                <p>{accountType === 'man'
                  ? 'Chat with women or gay members you have contacted.'
                  : 'Messages from men who have reached out to you.'}</p>
              </div>
              {activeConversation ? (
                <section className="conversation-panel">
                  <div className="conversation-header">
                    <button type="button" className="back-button" onClick={() => setActiveConversationId('')} aria-label="Back to messages">←</button>
                    {getProfilePhotoSource(activeConversation)
                      ? <img src={getProfilePhotoSource(activeConversation)} alt="" />
                      : <span className="conversation-avatar-placeholder">{activeConversation.avatar}</span>}
                    <div><strong>{activeConversation.name}, {activeConversation.age}</strong><small>{activeConversation.location}</small></div>
                  </div>
                  <div className="conversation-body" aria-live="polite">
                    <p className="conversation-intro">You and {activeConversation.name} connected on Kidani. Say hello and start a respectful conversation.</p>
                    {conversationMessages.map((message) => (
                      <div className={message.sender === 'me' ? 'message-bubble mine' : 'message-bubble theirs'} key={message.id}>
                        <p>{message.text}</p>
                        <time dateTime={new Date(message.sentAt).toISOString()}>{new Date(message.sentAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</time>
                      </div>
                    ))}
                    <p className="local-message-note">Messages are delivered securely through Kidani. Never share your password or M-Pesa PIN.</p>
                  </div>
                  <form className="message-compose" onSubmit={sendMessage}>
                    <input
                      aria-label="Write a message"
                      value={messageDraft}
                      onChange={(event) => setMessageDraft(event.target.value)}
                      placeholder={`Message ${activeConversation.name}…`}
                      maxLength={1000}
                    />
                    <button type="submit" className="send-message-button" disabled={!messageDraft.trim()} aria-label="Send message">➤</button>
                  </form>
                </section>
              ) : interactedMatches.length ? (
                <div className="activity-list">
                  {interactedMatches.map((match) => {
                    return (
                      <button className="activity-card conversation-list-item" type="button" key={match.id} onClick={() => setActiveConversationId(match.id)}>
                        {getProfilePhotoSource(match)
                          ? <img src={getProfilePhotoSource(match)} alt="" />
                          : <span className="conversation-avatar-placeholder">{match.avatar}</span>}
                        <div>
                          <strong>{match.name}, {match.age}</strong>
                          <span>{match.lastMessage ?? `You sent interest · ${match.location}`}</span>
                        </div>
                        <span className="activity-heart" aria-hidden="true">›</span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="empty-state">
                  <span className="empty-icon" aria-hidden="true">✉</span>
                  <h2>No conversations yet</h2>
                  <p>{accountType === 'man'
                    ? 'Choose a profile in Gundua and tap INTERACT to open their details and start a conversation.'
                    : `Messages and interests from other members will appear here.`}</p>
                  {accountType === 'man' ? <button className="primary-action" type="button" onClick={() => selectTab('discover')}>Explore profiles</button> : null}
                </div>
              )}
              {!activeConversation ? <div className="safety-card"><span aria-hidden="true">✦</span><p><strong>Good connections start with care.</strong><br />Take your time getting to know someone before sharing personal details.</p></div> : null}
            </section>
          ) : null}

          {activeTab === 'wallet' && accountType !== 'man' ? (
            <section className="tab-view wallet-view">
              <div className="page-intro">
                <p className="eyebrow">KIDANI MEMBERSHIP</p>
                <h1>{copy.walletTitle}</h1>
                <p>{copy.walletSubtitle}</p>
              </div>
              <section className="jiboost-panel">
                <div className="jiboost-heading"><p className="eyebrow">KIDANI JIBOOST</p><h2>Grow your visibility</h2><p>Choose an action to manage your profile and Kifurushi.</p></div>
                <div className="jiboost-actions">
                  <button type="button" className="jiboost-action featured" onClick={activateBoost}>
                    <span className="jiboost-icon" aria-hidden="true">✦</span><strong>JIBOOST</strong><small>{boostCount} demo boosts</small>
                  </button>
                  <button type="button" className="jiboost-action" onClick={() => { setActiveTab('settings'); setNotice('Update your location in your profile settings.'); }}>
                    <span className="jiboost-icon" aria-hidden="true">⌖</span><strong>BADILI LOCATION</strong><small>Change your current location</small>
                  </button>
                  <button type="button" className="jiboost-action" onClick={() => document.getElementById('package-plans')?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
                    <span className="jiboost-icon" aria-hidden="true">▣</span><strong>ONGEZA KIFURUSHI</strong><small>Choose a membership plan</small>
                  </button>
                </div>
              </section>
              <section className="active-package-card">
                <div><p className="eyebrow">KIFURUSHI CHAKO</p><strong>Hakuna kifurushi kinachotumika</strong></div>
                <p className="demo-package-note">Membership appears here after payment is verified by the Kidani admin.</p>
              </section>
              <div className="membership-note"><span aria-hidden="true">✦</span><div><strong>A little more possibility</strong><span>Membership helps you make the most of your introductions.</span></div></div>
              <div id="package-plans" className="plan-list">
                {membershipPlans.map((plan) => (
                  <article className={selectedPlan === plan.id ? 'plan-card selected' : 'plan-card'} key={plan.id}>
                    {plan.id === 'premium' ? <span className="popular-label">KIDANI PREMIUM</span> : null}
                    <div className="plan-heading">
                      <span className={selectedPlan === plan.id ? 'radio selected' : 'radio'} />
                      <div><h2>{plan.name}</h2><p>{plan.duration}</p></div>
                      <strong className="plan-price">{plan.price}</strong>
                    </div>
                    <ul>{plan.features.map((feature) => <li key={feature}><span>✓</span>{feature}</li>)}</ul>
                    <button className={selectedPlan === plan.id ? 'plan-button selected' : 'plan-button'} type="button" onClick={() => choosePlan(plan.id)}>
                      {selectedPlan === plan.id ? copy.selected : copy.choose}
                    </button>
                  </article>
                ))}
              </div>
              <section id="payment-guide" className="payment-guide">
                <div className="payment-guide-heading">
                  <p className="eyebrow">MALIPO KWA ADMIN</p>
                  <h2>Lipa kwa M-Pesa</h2>
                  <p>Chagua kifurushi, tuma malipo kwa namba iliyo hapa chini, kisha tuma uthibitisho WhatsApp.</p>
                </div>
                <div className="payment-recipient">
                  <span className="payment-recipient-icon" aria-hidden="true">▣</span>
                  <div><span>Tuma kwa namba ya M-Pesa</span><strong>{mobileMoneyNumber}</strong><small>Jina la mpokeaji: {paymentRecipient}</small></div>
                </div>
                {checkoutOpen ? (
                  <div className="checkout-summary" aria-live="polite">
                    <p className="eyebrow">CONFIRM BEFORE PAYING</p>
                    <h3>{membershipPlans.find((plan) => plan.id === selectedPlan)?.name}</h3>
                    <dl>
                      <div><dt>Kiasi / Amount</dt><dd>{membershipPlans.find((plan) => plan.id === selectedPlan)?.price}</dd></div>
                      <div><dt>Mpokeaji / Recipient</dt><dd>{paymentRecipient} · {mobileMoneyNumber}</dd></div>
                      <div><dt>Namba yako / Your M-Pesa number</dt><dd>{paymentPhone || 'Add a number in Settings'}</dd></div>
                    </dl>
                    {isValidPhoneNumber(paymentPhone) ? (
                      <a className="payment-receipt-button mpesa-launch-button" href="tel:*150*00%23">Open M-Pesa on this phone</a>
                    ) : (
                      <button className="payment-receipt-button mpesa-launch-button" type="button" onClick={() => selectTab('settings')}>Add your M-Pesa number in Settings</button>
                    )}
                    <p className="mpesa-safety-note">The M-Pesa menu must show <strong>{paymentRecipient}</strong> and the exact amount before you confirm. Enter your M-Pesa PIN only in the M-Pesa menu, never in Kidani.</p>
                  </div>
                ) : null}
                <ol className="payment-steps">
                  <li><span>1</span><p>Fungua M-Pesa na uchague <strong>Tuma Pesa</strong>, kisha weka namba ya simu iliyo hapo juu.</p></li>
                  <li><span>2</span><p>Ingiza <strong>{mobileMoneyNumber}</strong> na uhakikishe jina linaloonekana ni <strong>{paymentRecipient}</strong> kabla ya kuendelea.</p></li>
                  <li><span>3</span><p>Lipa <strong>{membershipPlans.find((plan) => plan.id === selectedPlan)?.price ?? 'kiasi cha kifurushi ulichochagua'}</strong>. Reference ikiombwa, tumia namba yako ya simu ya Kidani.</p></li>
                  <li><span>4</span><p>Hifadhi ujumbe wa muamala, kisha tuma picha ya risiti WhatsApp <strong>{supportNumber}</strong> kwa uthibitisho wa mkono.</p></li>
                </ol>
                <a
                  className="payment-receipt-button"
                  href={`https://wa.me/255${supportNumber.slice(1)}?text=${encodeURIComponent(`Habari Kidani, nimetuma malipo ya ${membershipPlans.find((plan) => plan.id === selectedPlan)?.name ?? 'Kifurushi'}. Namba yangu ya Kidani ni ${paymentPhone}.`)}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Tuma uthibitisho WhatsApp
                </a>
                <p className="demo-payment-note"><span aria-hidden="true">ⓘ</span> {copy.demoPayment} Usitume malipo ikiwa jina la mpokeaji halilingani.</p>
              </section>
            </section>
          ) : null}

          {activeTab === 'settings' ? (
            <section className="tab-view settings-view">
              <div className="page-intro">
                <p className="eyebrow">YOUR KIDANI</p>
                <h1>{copy.profileTitle}</h1>
                <p>Make your experience feel like you.</p>
              </div>

              <a className="support-card" href={`https://wa.me/255${supportNumber.slice(1)}`} target="_blank" rel="noreferrer">
                <span className="support-icon" aria-hidden="true">◉</span>
                <div><strong>Msaada / Support · WhatsApp</strong><span>Wasiliana nasi kupitia {supportNumber}</span></div>
                <span className="support-arrow" aria-hidden="true">↗</span>
              </a>
              <div className="social-links">
                <button type="button" onClick={() => setNotice('The official Kidani WhatsApp channel link will be added soon.')}>
                  <span className="social-icon whatsapp">◉</span><strong>WhatsApp channel</strong>
                </button>
                <button type="button" onClick={() => setNotice('The official Kidani Instagram link will be added soon.')}>
                  <span className="social-icon instagram">◎</span><strong>Instagram</strong>
                </button>
                <button type="button" onClick={() => setNotice('Kidani videos will be available here soon.')}>
                  <span className="social-icon video">▶</span><strong>Watch video</strong>
                </button>
              </div>

              <div className="settings-panel">
                <div className="setting-row">
                  <span>{copy.language}</span>
                  <div className="segmented-control" aria-label={copy.language}>
                    <button type="button" className={language === 'en' ? 'active' : ''} onClick={() => chooseLanguage('en')}>English</button>
                    <button type="button" className={language === 'sw' ? 'active' : ''} onClick={() => chooseLanguage('sw')}>Kiswahili</button>
                  </div>
                </div>
              </div>

              <div className="settings-profile">
                  <div className="settings-profile-heading"><span className="profile-avatar">{profile.avatar}</span><div><strong>{profile.name}</strong><span>{profile.email}</span></div></div>
                  <section className="profile-options-card">
                    <div className="profile-options-heading">
                      <p className="eyebrow">SETTING PROFILE</p>
                      <h2>Profile details</h2>
              </div>
                    {accountType !== 'man' ? (
                      <>
                        <div className="photo-settings">
                          <div className="profile-photo-preview">
                            {profilePhoto ? <img src={profilePhoto} alt="Your profile photo" /> : <span aria-hidden="true">▧</span>}
                          </div>
                          <div className="photo-settings-actions">
                            <strong>Picha ya wasifu</strong>
                            <div>
                              <label className="outline-action" htmlFor="profile-photo-upload">Ongeza picha</label>
                              <input id="profile-photo-upload" className="visually-hidden" type="file" accept="image/*" onChange={handleProfilePhoto} />
                              <label className="outline-action" htmlFor="profile-camera">Piga picha</label>
                              <input id="profile-camera" className="visually-hidden" type="file" accept="image/*" capture="user" onChange={handleProfilePhoto} />
                              <button type="button" className="outline-action danger" onClick={() => {
                                void removeProfilePhoto();
                              }} disabled={!profilePhoto}>Futa picha hii</button>
                            </div>
                          </div>
                        </div>
                        <section className="verification-section">
                          <div className="verification-heading">
                            <p className="eyebrow">THIBITISHA WASIFU</p>
                            <h3>View Once photo verification</h3>
                            <p>Compare the uploaded profile picture with a live camera photo. This preview is held in this browser session and is not uploaded for admin review.</p>
                          </div>
                          {profilePhoto || verificationPhoto ? (
                            <div className="verification-comparison">
                              <div>{profilePhoto ? <img src={profilePhoto} alt="Uploaded profile photo" /> : <span>Upload a profile photo</span>}<small>Profile photo</small></div>
                              <div>{verificationPhoto ? <img src={verificationPhoto} alt="Camera verification photo" /> : <span>Capture a photo</span>}<small>View Once photo</small></div>
                            </div>
                          ) : null}
                          {cameraOpen ? (
                            <div className="camera-capture">
                              <video ref={videoRef} autoPlay playsInline muted aria-label="Live verification camera preview" />
                              <div className="camera-actions">
                                <button type="button" className="primary-action" onClick={captureVerificationPhoto}>Capture photo</button>
                                <button type="button" className="secondary-action" onClick={() => setCameraOpen(false)}>Cancel</button>
                              </div>
                            </div>
                          ) : null}
                          {cameraError ? <p className="camera-error" role="alert">{cameraError}</p> : null}
                          <div className="verification-actions">
                            <button type="button" className="outline-action" onClick={() => { setCameraError(''); setCameraOpen(true); }}>Open camera</button>
                            <label className="outline-action" htmlFor="verification-photo-upload">Upload View Once photo</label>
                            <input id="verification-photo-upload" className="visually-hidden" type="file" accept="image/*" capture="user" onChange={handleVerificationPhoto} />
                          </div>
                          <p className={verificationStatus === 'pending' ? 'verification-status pending' : 'verification-status'}>
                            {verificationStatus === 'pending' ? 'Photo preview is in this browser session only; no admin review is available yet.' : 'No verification photo submitted.'}
                          </p>
                        </section>
                        <button
                          type="button"
                          className={viewOnce ? 'view-once-control enabled' : 'view-once-control'}
                          aria-pressed={viewOnce}
                          onClick={() => setViewOnce((current) => !current)}
                        >
                          <span aria-hidden="true">◈</span>
                          <span><strong>View Once</strong><small>Keep this verification preview in the current browser session only.</small></span>
                          <span className="control-state">{viewOnce ? 'ON' : 'OFF'}</span>
                        </button>
                        <div className="service-settings">
                          <div className="service-heading">
                            <div><span className="field-caption">Huduma zinazotolewa</span><p>Add services and set your price in TSH. You can edit or remove them anytime.</p></div>
                          </div>
                          <div className="service-add-row">
                            <label className="service-select-wrap">
                              <span className="visually-hidden">Choose a service</span>
                              <select className="dark-input" value={newServiceId} onChange={(event) => setNewServiceId(event.target.value)}>
                                <option value="">Chagua huduma</option>
                                {serviceOptions.map((service) => <option value={service.id} key={service.id}>{service.name}</option>)}
                              </select>
                            </label>
                            <label className="amount-input-wrap">
                              <span className="visually-hidden">Service amount in TSH</span>
                              <input className="dark-input" type="number" min="1" step="1000" placeholder="Kiasi TSH" value={newServiceAmount} onChange={(event) => setNewServiceAmount(event.target.value)} />
                            </label>
                            <button type="button" className="outline-action" onClick={addService}>Ongeza</button>
                          </div>
                          <div className="service-list">
                            {services.map((service) => (
                              <div className="service-option editable" key={service.id}>
                                <strong>{service.name}</strong>
                                <label><span className="visually-hidden">{service.name} amount in TSH</span>
                                  <input className="service-amount" type="number" min="0" step="1000" value={service.amount} onChange={(event) => updateServiceAmount(service.id, event.target.value)} />
                                  <small>Tsh</small>
                                </label>
                                <button type="button" className="remove-service" onClick={() => removeService(service.id)} aria-label={`Remove ${service.name}`}>×</button>
                              </div>
                            ))}
                            {!services.length ? <p className="empty-services">No services added yet.</p> : null}
                          </div>
                        </div>
                        <div className="phone-settings">
                          <label className="field-caption" htmlFor="whatsapp-number">Namba ya WhatsApp</label>
                          <input id="whatsapp-number" className="dark-input" type="tel" value={whatsappNumber} placeholder="+255..." onChange={(event) => setWhatsappNumber(event.target.value)} />
                          <label className="field-caption" htmlFor="call-number">Namba ya simu (calls & messages)</label>
                          <input id="call-number" className="dark-input" type="tel" value={callNumber} placeholder="+255..." onChange={(event) => setCallNumber(event.target.value)} />
                        </div>
                      </>
                    ) : null}

                    <div className="profile-edit-fields">
                      <label>Jina / Name<input className="dark-input" value={draft.name} onChange={(event) => setDraft((previous) => ({ ...previous, name: event.target.value }))} /></label>
                      <label>Umri / Age<input className="dark-input" type="number" min="18" max="120" value={draft.age} onChange={(event) => setDraft((previous) => ({ ...previous, age: event.target.value }))} /></label>
                      <label>Jiji / Current location<input className="dark-input" value={draft.location} onChange={(event) => setDraft((previous) => ({ ...previous, location: event.target.value }))} /></label>
                      <label>M-Pesa phone number<input className="dark-input" type="tel" inputMode="tel" autoComplete="tel" value={paymentPhone} placeholder="e.g. 07xx xxx xxx" onChange={(event) => setPaymentPhone(event.target.value)} /></label>
                      {accountType === 'man' ? <label className="bio-edit">Bio<textarea className="dark-input" rows={4} maxLength={500} value={draft.bio} placeholder="Write a little about yourself…" onChange={(event) => setDraft((previous) => ({ ...previous, bio: event.target.value }))} /></label> : null}
                    </div>

                    <div className="gps-settings">
                      <span className="gps-icon" aria-hidden="true">⌖</span>
                      <div><strong>Location</strong><small>{gpsStatus || 'Update with GPS or enter the city above.'}</small></div>
                      <button type="button" className="outline-action" onClick={updateGpsLocation}>Badili location</button>
                    </div>
                    <button type="button" className="save-profile-button" onClick={saveProfileDraft}>Save profile</button>
                  </section>
                  <button type="button" className="sign-out-button" onClick={() => void handleSignOut()}>Sign out</button>
                </div>
              <p className="settings-footer">Kidani · Real connection, at your pace.</p>
            </section>
          ) : null}
        </main>

        <nav className={accountType === 'man' ? 'bottom-nav man-bottom-nav' : 'bottom-nav'} aria-label="Main navigation">
          {([
            ['discover', copy.discover, '⌂'],
            ['messages', copy.messages, '✉'],
            ['wallet', copy.wallet, '▣'],
            ['settings', copy.settings, '⚙'],
          ] as const).filter(([tab]) => tab !== 'wallet' || accountType !== 'man').map(([tab, label, icon]) => (
            <button type="button" key={tab} className={activeTab === tab ? 'nav-item active' : 'nav-item'} onClick={() => selectTab(tab)} aria-current={activeTab === tab ? 'page' : undefined}>
              <span className="nav-icon" aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}

export default App;
