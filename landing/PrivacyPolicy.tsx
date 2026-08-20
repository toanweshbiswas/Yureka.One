import React, { useEffect } from 'react';
import { motion } from 'motion/react';
import { Shield, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import SEO from '@shared/SEO';
import { staticPageMeta } from '@backend/lib/seo/pageMeta';

const PrivacyPolicy: React.FC = () => {
    // Scroll to top on mount
    useEffect(() => {
        window.scrollTo(0, 0);
    }, []);

    return (
        <div className="bg-cream min-h-screen text-white pb-32 selection:bg-clay selection:text-cream">
            <SEO {...staticPageMeta['/privacy-policy']} />
            {/* Header Section */}
            <div className="pt-6 md:pt-16 pb-16 md:pb-24 border-b border-white/10 px-6">
                <div className="max-w-4xl mx-auto text-center md:text-left">
                    <div className="flex items-center justify-center md:justify-start gap-2 text-clay mb-6">
                        <Shield size={18} strokeWidth={2.5} />
                        <span className="text-[10px] font-bold uppercase tracking-[0.4em]">Legal Compendium</span>
                    </div>
                    <h1 className="text-5xl md:text-8xl font-heading font-extrabold leading-[0.9] tracking-tighter mb-8 uppercase text-white">
                        Privacy Policy
                    </h1>
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                        <p className="text-xl md:text-2xl font-serif italic text-white/60">
                            How we protect your financial data.
                        </p>
                        <div className="text-center md:text-right">
                            <p className="text-[10px] uppercase tracking-widest font-bold text-white/40">Last Updated</p>
                            <p className="text-sm font-mono mt-1 text-clay border-b border-clay/30 inline-block pb-1">19th August 2026</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content Section */}
            <div className="max-w-4xl mx-auto px-6 pt-16 md:pt-24 font-serif text-lg md:text-xl leading-relaxed text-white/80 space-y-16">
                
                <section>
                    <p className="first-letter:text-6xl first-letter:font-bold first-letter:text-clay first-letter:mr-2 first-letter:float-left first-letter:leading-none">
                        At Yureka.One, we understand the importance of safeguarding your privacy and protecting your personal information. Throughout this Privacy Policy, when we mention "the Company," "Yureka.One," "We," "Us," or "Our," we are referring to Yureka.One and its affiliates.
                    </p>
                </section>

                <section className="space-y-6">
                    <h2 className="text-3xl font-heading font-extrabold uppercase tracking-tight text-white border-b-2 border-white/10 pb-4">Collection of Information</h2>
                    <p>Yureka.One collects various types of information to provide you with our services effectively. This information includes:</p>
                    <ul className="space-y-4 list-none pl-0">
                        <li className="pl-6 relative">
                            <span className="absolute left-0 top-1 text-clay font-bold">&bull;</span>
                            <strong className="text-white tracking-tight uppercase text-sm mr-2">User Provided Information:</strong> When you register or use Yureka.One, it is necessary to provide personal details such as your name, email address, contact number, and other relevant information.
                        </li>
                        <li className="pl-6 relative">
                            <span className="absolute left-0 top-1 text-clay font-bold">&bull;</span>
                            <strong className="text-white tracking-tight uppercase text-sm mr-2">Information Generated Through Use:</strong> We gather data about the services you use on Yureka.One, your interactions with our platform, transaction details, and other usage metrics to enhance your experience.
                        </li>
                        <li className="pl-6 relative">
                            <span className="absolute left-0 top-1 text-clay font-bold">&bull;</span>
                            <strong className="text-white tracking-tight uppercase text-sm mr-2">Information from Third Parties:</strong> With your explicit consent, we may obtain information from third parties to authenticate your identity, provide specific services, or personalize your experience.
                        </li>
                        <li className="pl-6 relative">
                            <span className="absolute left-0 top-1 text-clay font-bold">&bull;</span>
                            <strong className="text-white tracking-tight uppercase text-sm mr-2">Google Account Information:</strong> If you sign in with Google, we receive basic profile information such as your name and email address (and profile picture if provided by Google) to create and authenticate your Yureka account.
                        </li>
                        <li className="pl-6 relative">
                            <span className="absolute left-0 top-1 text-clay font-bold">&bull;</span>
                            <strong className="text-white tracking-tight uppercase text-sm mr-2">Gmail Data (Optional, Explicit Consent):</strong> If you choose to connect Gmail for spending insights or Yureka Score, we request read-only access to your Gmail inbox solely to identify purchase, bill, and payment-related messages. We do not send email as you, modify your mail, or use inbox content for advertising.
                        </li>
                    </ul>
                    <p className="italic text-base text-white/40 border-l-2 border-clay/30 pl-4 mt-6">
                        The nature and amount of information collected depends upon the type of interaction between the company and the user.
                    </p>
                </section>

                <section className="space-y-6">
                    <h2 className="text-3xl font-heading font-extrabold uppercase tracking-tight text-white border-b-2 border-white/10 pb-4">Chrome Extension</h2>
                    <p>
                        The Yureka Chrome extension exists to show marketplace coupons and Goldback for the store you are currently visiting. To do that, it reads the hostname of the active tab (for example <span className="text-white">myntra.com</span>) and sends that hostname to <span className="text-white">https://app.yureka.one</span> so we can return matching offers.
                    </p>
                    <ul className="list-disc pl-8 space-y-4 text-white/70">
                        <li>We do not read page content, passwords, payment details, or form fields.</li>
                        <li>We do not sell extension data. Hostname lookups are used only to match offers for that store.</li>
                        <li>You can dismiss the on-page bar for the rest of that tab session. Uninstalling the extension stops lookups.</li>
                        <li>Standard HTTPS request metadata (such as IP address) may appear in server logs for security and reliability.</li>
                    </ul>
                </section>

                <section className="space-y-6">
                    <h2 className="text-3xl font-heading font-extrabold uppercase tracking-tight text-white border-b-2 border-white/10 pb-4">Google / Gmail Access</h2>
                    <p>
                        Yureka uses Google OAuth for sign-in on <span className="text-white font-bold">app.yureka.one</span>. Separately, and only when you opt in, we may request Gmail read-only permission to analyse transaction and billing emails for spend insights, waitlist scoring, and related product features.
                    </p>
                    <ul className="list-disc pl-8 space-y-4 text-white/70">
                        <li>Gmail access is optional. You can use core account features without granting inbox access.</li>
                        <li>We process only what is needed to extract merchant, amount, date, and similar transaction metadata from relevant messages.</li>
                        <li>We do not sell your Gmail content. Access tokens are used to run analysis and are not used to send mail on your behalf.</li>
                        <li>You may revoke Google access at any time in your Google Account permissions, and/or email <a href="mailto:support@yureka.one" className="text-clay underline">support@yureka.one</a> to request deletion of derived spending data.</li>
                    </ul>
                </section>

                <section className="space-y-6">
                    <h2 className="text-3xl font-heading font-extrabold uppercase tracking-tight text-white border-b-2 border-white/10 pb-4">Use of Information</h2>
                    <p>Yureka.One utilises the collected information for various purposes, including but not limited to:</p>
                    <ul className="list-disc pl-8 space-y-4 text-white/70">
                        <li>Providing, personalising, and improving our services to meet your needs.</li>
                        <li>Processing transactions and delivering requested services efficiently.</li>
                        <li>Communicating with you about your account, updates, and to send you promotional, marketing, and advertising content related to our services, products, and offerings. This content may be delivered via various channels, including email, SMS messages, WhatsApp messages, and RCS messages.</li>
                        <li>Detecting and preventing fraud, abuse, or security incidents to ensure a safe environment for all users.</li>
                        <li>Complying with legal obligations and enforcing our policies effectively.</li>
                    </ul>
                    <div className="bg-white/5 text-white/80 p-8 md:p-12 mt-8 border border-white/10 rounded-[2rem] shadow-2xl relative overflow-hidden backdrop-blur-sm">
                        <div className="absolute top-0 left-0 w-1.5 h-full bg-clay shadow-[0_0_15px_#00933b]"></div>
                        <p className="italic text-lg leading-relaxed">
                            You have the right to withdraw your consent and opt out of receiving promotional communications from us at any time. You can typically do this by following the unsubscribe instructions provided in the communication (e.g., clicking the unsubscribe link in an email or replying "STOP" to a text message).
                        </p>
                    </div>
                </section>

                <section className="space-y-6">
                    <h2 className="text-3xl font-heading font-extrabold uppercase tracking-tight text-white border-b-2 border-white/10 pb-4">Disclosure of Information</h2>
                    <p>Yureka.One may disclose your information to:</p>
                    <ul className="list-disc pl-8 space-y-4 text-white/70">
                        <li>Third-party service providers who assist us in delivering services, maintaining our platform, or analysing user data.</li>
                        <li>Partners or affiliates for the provision of specific services, promotions, or joint ventures.</li>
                        <li>Regulatory authorities, law enforcement agencies, or legal entities when required by law or to protect our rights and interests.</li>
                    </ul>
                    <p className="font-bold underline text-clay">We do not sell or lease your information to third parties for marketing purposes.</p>
                </section>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-12">
                    <section className="space-y-4">
                        <h2 className="text-3xl font-heading font-extrabold uppercase tracking-tight text-white border-b-2 border-white/10 pb-4">Cookies</h2>
                        <p className="text-base text-white/60 leading-relaxed">
                            Yureka.One uses cookies and similar tracking technologies to enhance your browsing experience, analyse site usage, and personalise content. You can manage your cookie preferences through your browser settings.
                        </p>
                    </section>
                    <section className="space-y-4">
                        <h2 className="text-3xl font-heading font-extrabold uppercase tracking-tight text-white border-b-2 border-white/10 pb-4">Security</h2>
                        <p className="text-base text-white/60 leading-relaxed">
                            We take the security of your information seriously and implement reasonable measures to protect it from unauthorised access, alteration, or disclosure. However, please note that no method of transmission over the internet or electronic storage is 100% secure.
                        </p>
                    </section>
                </div>

                <section className="space-y-8">
                    <h2 className="text-3xl font-heading font-extrabold uppercase tracking-tight text-white border-b-2 border-white/10 pb-4">Data Retention</h2>
                    <p>
                        Yureka.One deletes personal data upon a user’s request or in accordance with the retention timelines specified below. However, certain data may be retained by the company for legal or compliance purposes.
                    </p>
                    
                    <div className="overflow-x-auto border border-white/10 rounded-2xl bg-white/5 backdrop-blur-sm shadow-2xl">
                        <table className="w-full text-left text-sm md:text-base border-collapse">
                            <thead className="bg-white/10 text-white">
                                <tr>
                                    <th className="p-4 uppercase tracking-[0.2em] text-[10px] font-bold">Data Category</th>
                                    <th className="p-4 uppercase tracking-[0.2em] text-[10px] font-bold">Retention Period</th>
                                    <th className="p-4 uppercase tracking-[0.2em] text-[10px] font-bold">Purpose / Trigger</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                <tr className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-bold text-white">Registration <span className="block font-normal text-[10px] text-white/40 mt-1 uppercase tracking-widest">(Name, Email, Phone)</span></td>
                                    <td className="p-4 italic text-white/60">Account lifetime + 1 year</td>
                                    <td className="p-4 text-[10px] font-mono text-clay/60">Service delivery, fraud prevention<br/>Trigger: Account deletion</td>
                                </tr>
                                <tr className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-bold text-white">Transaction Data <span className="block font-normal text-[10px] text-white/40 mt-1 uppercase tracking-widest">(GVs, bills, rewards)</span></td>
                                    <td className="p-4 italic text-white/60">7 years</td>
                                    <td className="p-4 text-[10px] font-mono text-clay/60">RBI/PMLA compliance<br/>Trigger: End of legal hold</td>
                                </tr>
                                <tr className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-bold text-white">Usage Analytics <span className="block font-normal text-[10px] text-white/40 mt-1 uppercase tracking-widest">(Non-personal)</span></td>
                                    <td className="p-4 italic text-white/60">2 years</td>
                                    <td className="p-4 text-[10px] font-mono text-clay/60">Service improvement<br/>Trigger: Automated purge</td>
                                </tr>
                                <tr className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-bold text-white">Logs & Events <span className="block font-normal text-[10px] text-white/40 mt-1 uppercase tracking-widest">(Security)</span></td>
                                    <td className="p-4 italic text-white/60">1 year</td>
                                    <td className="p-4 text-[10px] font-mono text-clay/60">Breach investigation<br/>Trigger: Annual cycle</td>
                                </tr>
                                <tr className="hover:bg-white/5 transition-colors">
                                    <td className="p-4 font-bold text-white">KYC Documents <span className="block font-normal text-[10px] text-white/40 mt-1 uppercase tracking-widest">(Financial docs)</span></td>
                                    <td className="p-4 italic text-white/60">10 years</td>
                                    <td className="p-4 text-[10px] font-mono text-clay/60">Regulatory audits<br/>Trigger: Requirement expiry</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                </section>

                <section className="space-y-6">
                    <h2 className="text-3xl font-heading font-extrabold uppercase tracking-tight text-white border-b-2 border-white/10 pb-4">Consent Notice <span className="text-[10px] font-mono tracking-[0.2em] text-clay ml-4 uppercase">Per DPDP Rule 3</span></h2>
                    <p>Yureka.One processes your personal data (name, email, phone, transaction details, credit card usage) solely for:</p>
                    <ul className="list-disc pl-8 space-y-3 text-white/70">
                        <li>Reward optimization and bill payments (necessary for service delivery)</li>
                        <li>Fraud detection (legitimate use under DPDP)</li>
                        <li>Communications (with opt-out)</li>
                    </ul>
                    <p className="bg-white/5 p-8 border border-white/10 italic text-lg leading-relaxed rounded-[2rem] backdrop-blur-sm">
                        Consent is free, specific, informed, unconditional, and unambiguous. You may withdraw consent anytime without affecting prior lawful processing.
                    </p>
                    <div className="bg-white/5 p-8 md:p-12 rounded-[2rem] border border-white/10 backdrop-blur-sm shadow-2xl">
                        <h4 className="font-heading font-extrabold uppercase tracking-widest text-sm mb-6 text-white italic">Withdrawal Process</h4>
                        <ul className="space-y-6 text-base">
                            <li className="flex items-start gap-4">
                                <span className="text-clay font-bold text-xl leading-none">01.</span>
                                <span className="text-white/70">Email <a href="mailto:support@yureka.one" className="text-clay underline font-bold decoration-1 underline-offset-4">support@yureka.one</a> with <br /><span className="text-white italic">"Withdraw Consent - [Your Registered Email]"</span></span>
                            </li>
                            <li className="flex items-start gap-4">
                                <span className="text-clay font-bold text-xl leading-none">02.</span>
                                <span className="text-white/70">Deletion request erases all data within 72 hours (except legal retention)</span>
                            </li>
                            <li className="flex items-start gap-4">
                                <span className="text-clay font-bold text-xl leading-none">03.</span>
                                <span className="text-white/70">Post-withdrawal, core services (transaction tracking) may be limited.</span>
                            </li>
                        </ul>
                    </div>
                </section>
                
                <section className="border-t-4 border-white pt-16 mt-16 text-center space-y-10">
                     <p className="text-[10px] md:text-xs font-mono uppercase tracking-[0.3em] text-white/30 leading-relaxed max-w-3xl mx-auto">
                         Governing Law: This Privacy Policy is governed by the Digital Personal Data Protection Act, 2023 ("DPDP Act"), Digital Personal Data Protection Rules, 2025 ("DPDP Rules"), and applicable provisions of the Information Technology Act, 2000. Yureka.One, as a Data Fiduciary, complies with all obligations under Rule 3 (consent), Rule 6 (security safeguards), and Rule 13 (SDF requirements if applicable).
                     </p>
                     
                     <div className="pt-8">
                         <h3 className="text-2xl font-heading font-extrabold uppercase tracking-tight text-white mb-6 italic">Questions or Concerns?</h3>
                         <p className="text-white/40 italic mb-10 max-w-xl mx-auto text-base">If you have any questions, concerns, or requests regarding this Privacy Policy or your personal information, please contact us.</p>
                         <a href="mailto:support@yureka.one" className="inline-flex items-center gap-3 bg-white text-cream px-10 py-5 rounded-full uppercase font-bold tracking-[0.2em] text-[10px] hover:bg-clay hover:scale-105 transition-all shadow-2xl">
                             Contact Privacy Officer <ChevronRight size={14} />
                         </a>
                     </div>
                </section>
            </div>
            
            <div className="max-w-4xl mx-auto px-6 mt-24 flex items-center justify-center gap-4 text-[9px] font-mono uppercase tracking-[0.4em] text-white/20">
                <span>Yureka.One</span>
                <span className="w-1 h-1 bg-white/20 rounded-full"></span>
                <span>Jupyter Network Technologies Pvt Ltd</span>
            </div>
        </div>
    );
};

export default PrivacyPolicy;
