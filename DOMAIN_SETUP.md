# Domain Configuration: buddy.khamel.com → Vercel App

## Step 1: Add Custom Domain in Vercel

1. Go to your [Vercel Dashboard](https://vercel.com/dashboard)
2. Select your kid-friendly-ai project
3. Go to the **"Settings"** tab
4. Click on **"Domains"** in the left sidebar
5. Click **"Add"** and enter: `buddy.khamel.com`
6. Vercel will show you DNS records to configure

## Step 2: Configure DNS Records

You need to add the following DNS records to your khamel.com domain registrar:

### If using Vercel DNS (Recommended):
- Follow the instructions in Vercel to **"Switch Nameservers"** to:
  - `NS1.VERCEL.DNS`
  - `NS2.VERCEL.DNS`

### If keeping your current DNS provider:
Add these records:

#### A Record (for root domain if needed):
```
Type: A
Name: buddy
Value: 76.76.21.21 (Vercel's load balancer IP)
TTL: 3600 (or default)
```

#### CNAME Record (for subdomain):
```
Type: CNAME
Name: buddy
Value: cname.vercel-dns.com
TTL: 3600 (or default)
```

## Step 3: SSL Certificate

- Vercel automatically provisions SSL certificates
- This may take a few minutes to complete
- Check the domain status in Vercel dashboard

## Step 4: Verify Configuration

1. Wait for DNS propagation (can take up to 24 hours, usually 5-30 minutes)
2. Visit `https://buddy.khamel.com` to verify it works
3. Check SSL certificate is valid

## Step 5: Update Any Environment Variables

Make sure your Vercel project has all necessary environment variables configured:
- `OPENAI_API_KEY` (for AI functionality)
- Any other required API keys

## Troubleshooting

### Common Issues:
- **DNS not propagated**: Use [DNSChecker.org](https://dnschecker.org) to check propagation
- **SSL not issued**: Wait 30-60 minutes, Vercel issues certificates automatically
- **Domain not accessible**: Verify DNS records are correct

### Vercel Documentation:
- [Vercel Custom Domain Guide](https://vercel.com/docs/projects/custom-domains)
- [DNS Configuration](https://vercel.com/docs/projects/custom-domains/configure-a-dns)

## Alternative: Vercel Automatic Configuration

If you prefer automatic configuration:
1. In Vercel, when adding the domain, click **"Automatic Configuration"**
2. Vercel will provide nameservers to use
3. Update your domain registrar's nameservers to the ones Vercel provides

## Note on Caddy SSL

Since you mentioned using Caddy SSL certificates:
- Vercel handles SSL automatically, so you don't need Caddy for this
- If you want to use Caddy as a proxy, you'll need to point the DNS to your server instead

## Post-Configuration

Once the domain is working:
1. Test all game functionality
2. Verify speech recognition works
3. Check that all API endpoints are accessible
4. Test on mobile devices

The domain setup should be straightforward through Vercel's interface. The automatic configuration is usually the easiest approach.