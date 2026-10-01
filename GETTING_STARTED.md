# Getting Started with Opportunity Intelligence

This guide helps you discover and qualify business leads using the opportunity intelligence system.

## Prerequisites

1. **Google Maps API Key**: Required for live business discovery
   - Enable the Places API (New) in your Google Cloud project
   - Set `GOOGLE_MAPS_API_KEY` in your `.env` file

2. **Database**: MySQL/MariaDB running locally or accessible via connection string

## Quick Start

### 1. Find Clinic Leads in Your City

Run a discovery batch for clinics and hospitals:

```bash
cd packages/opportunity-intelligence
pnpm discover --niche=clinics-hospitals --city="Karachi" --limit=20
```

**Parameters:**
- `--niche`: Niche profile to use (`clinics-hospitals` or `saudi-umrah`)
- `--city`: Target city for discovery (e.g., "Karachi", "Lahore", "Makkah")
- `--limit`: Maximum businesses to discover (1-20, default: 20)

**Example for other cities:**
```bash
pnpm discover --niche=clinics-hospitals --city="Lahore" --limit=15
pnpm discover --niche=clinics-hospitals --city="Islamabad" --limit=10
```

### 2. View Results

The discovery run will:
1. **Discover** businesses via Google Places API using healthcare-specific queries
2. **Research** each business by auditing their website (or lack thereof)
3. **Score** opportunities based on digital gaps and business signals
4. **Generate** personalized outreach drafts (email/WhatsApp)

Results are saved to the database and viewable in the web UI at `/opportunities`.

### 3. Review Outreach Drafts

All outreach is **draft-only** by design:
- No messages are sent automatically
- Each opportunity includes a `mailto:` link or copy-paste template
- Review and customize before sending

## Niche Profiles

### Clinics & Hospitals

**Target:** Medical facilities needing digital infrastructure

**Scoring signals:**
- No website or outdated site
- No online appointment booking
- No HTTPS / poor security
- WhatsApp-only booking
- Poor appointment-related reviews

**Outreach focus:**
- Modern website development
- Online booking systems
- Patient portals
- Secure payment integration
- Hospital/clinic ERP systems

**Discovery queries:**
- clinic
- hospital
- dental clinic
- medical center
- diagnostic lab
- polyclinic

### Saudi Umrah Services

**Target:** Umrah travel operators, hotels, and transportation

**Scoring signals:**
- Manual booking workflows
- Missing payment integration
- Poor multilingual support
- WhatsApp-only inquiries

**Discovery queries:**
- Umrah travel agency
- Umrah hotel
- Umrah transport

## Configuration

### Set Target City via Environment

Instead of passing `--city` every time, set a default:

```bash
# .env
OPPORTUNITY_NICHE_ID=clinics-hospitals
OPPORTUNITY_NICHE_GEOGRAPHIES=Karachi,Lahore
OPPORTUNITY_DISCOVERY_LIMIT=20
```

Then run:
```bash
pnpm discover
```

### Web UI Discovery

Start the web application:
```bash
cd ../../apps/web
pnpm dev
```

Navigate to `/opportunities` and use the discovery controls to:
1. Select a niche profile
2. Choose target city/region
3. Set batch limit
4. Run discovery

## What Happens During Discovery?

1. **Discovery Stage**: Google Places API searches for businesses matching the niche profile's queries in the target city

2. **Deduplication**: Removes duplicate businesses found across multiple queries

3. **Research Stage**: For each unique business:
   - Fetches and analyzes their website (if present)
   - Identifies digital gaps: no website, no booking, no payments, no HTTPS, etc.
   - Extracts social media links (when published on their own site)

4. **Audit Stage**: Scores businesses based on:
   - Digital presence maturity
   - Operational signals from evidence
   - Problem severity and confidence

5. **Problem Detection**: Identifies concrete problems such as:
   - "No public digital storefront"
   - "Missing online appointment booking"
   - "No secure payment checkout"

6. **Scoring Stage**: Calculates opportunity scores using:
   - Problem severity
   - Demand evidence
   - Ability to pay
   - Reachability
   - Solution fit
   - Competitive gap

7. **Outreach Generation**: Creates personalized draft messages using niche-specific templates with real evidence

## API Quota & Limits

- **Google Places API**: Each search returns up to 20 results
- **Discovery Limit**: Capped at 20 businesses per batch by default (respects API quota)
- **Rate Limiting**: Built-in delays between requests to avoid quota exhaustion

## Outreach Templates

Templates are niche-specific and support variable substitution:

**Available variables:**
- `{{businessName}}`: Name of the business
- `{{primaryProblem}}`: Top-ranked problem identified
- `{{solutionTitle}}`: Opportunity title
- `{{specificObservation}}`: Concrete finding from website audit
- `{{concreteOffer}}`: Context-aware value proposition

**Example (Clinics & Hospitals):**
```
Subject: Quick observation about {{businessName}}'s online presence

Hi {{businessName}} team,

I came across your practice while researching local healthcare providers. 
I noticed {{specificObservation}}.

I've worked on similar projects for medical facilities — {{concreteOffer}}. 
This typically improves patient experience and reduces administrative load.

Would a brief 10-minute call this week work to discuss what might fit your needs?

Best regards
```

## Troubleshooting

### "GOOGLE_MAPS_API_KEY is not configured"

1. Obtain a Google Cloud API key
2. Enable "Places API (New)" in your project
3. Add to `.env`: `GOOGLE_MAPS_API_KEY=your_key_here`

### "No businesses found"

- Try a different city or region
- Check that the niche profile's `discoveryQueries` match the target market
- Verify Google Places API quota hasn't been exhausted

### Database Connection Error

Ensure MySQL is running and connection details are correct:
```bash
MYSQL_HOST=localhost
MYSQL_PORT=3306
MYSQL_USER=root
MYSQL_PASSWORD=
MYSQL_DATABASE=umer_ai_os
```

## Next Steps

1. **Run your first batch**: `pnpm discover --niche=clinics-hospitals --city="Karachi"`
2. **Review opportunities**: Open `/opportunities` in the web UI
3. **Customize outreach**: Review and edit draft messages before sending
4. **Add more niches**: Edit `src/niche-profiles.ts` to define new market segments

## Support

For questions or issues:
- Check the `Business/Opportunity_Intelligence_PIPELINE.md` documentation
- Review the niche profile definitions in `src/niche-profiles.ts`
- Examine the test files for usage examples
