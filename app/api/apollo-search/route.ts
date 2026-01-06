import { NextRequest, NextResponse } from 'next/server'

const APOLLO_API_KEY = process.env.APOLLO_API_KEY
const APOLLO_BASE_URL = 'https://api.apollo.io/v1'

interface ApolloSearchParams {
  clientId: string
  industries: string[]
  locations: string[]
  employeeMin: number
  employeeMax: number
  titles: string[]
  seniorities: string[]
  maxCompanies: number
  maxContactsPerCompany: number
  enrichContacts?: boolean // Optional: enrich contacts to get emails/phones (uses credits)
}

interface PersonDetail {
  id?: string
  first_name?: string
  last_name?: string
  organization_name?: string
  domain?: string
  linkedin_url?: string
}

async function apolloRequest(endpoint: string, data: Record<string, unknown>) {
  const response = await fetch(`${APOLLO_BASE_URL}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
      'X-Api-Key': APOLLO_API_KEY || ''
    },
    body: JSON.stringify(data)
  })
  
  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Apollo API error: ${response.status} - ${error}`)
  }
  
  return response.json()
}

// Enrich a single contact to get email (uses Apollo credits)
async function enrichPerson(person: PersonDetail): Promise<{
  email: string
  emailStatus: string
  phone: string
} | null> {
  try {
    console.log(`   Enriching: ${person.first_name} ${person.last_name} at ${person.organization_name}`)
    
    const response = await apolloRequest('/people/match', {
      id: person.id,
      first_name: person.first_name,
      last_name: person.last_name,
      organization_name: person.organization_name,
      domain: person.domain,
      linkedin_url: person.linkedin_url,
      reveal_personal_emails: true
    })
    
    console.log(`   Response keys: ${Object.keys(response).join(', ')}`)
    
    const match = response.person
    if (match) {
      console.log(`   ✓ Found: email=${match.email || 'N/A'}, status=${match.email_status || 'N/A'}`)
      return {
        email: match.email || '',
        emailStatus: match.email_status || 'unknown',
        phone: match.phone_numbers?.[0]?.sanitized_number || 
               match.sanitized_phone || 
               match.phone_number || ''
      }
    } else {
      console.log(`   ✗ No person found in response`)
    }
  } catch (error) {
    console.error(`   ✗ Error: ${error instanceof Error ? error.message : 'Unknown'}`)
  }
  return null
}

// Enrich contacts to get emails (uses Apollo credits)
async function enrichPeopleBulk(people: PersonDetail[]) {
  if (people.length === 0) return []
  
  const enrichedPeople: Array<{
    id: string
    email: string
    emailStatus: string
    phone: string
  }> = []
  
  // Process one by one using the single match endpoint
  for (const person of people) {
    const enriched = await enrichPerson(person)
    if (enriched) {
      enrichedPeople.push({
        id: person.id || '',
        ...enriched
      })
    } else {
      enrichedPeople.push({
        id: person.id || '',
        email: '',
        emailStatus: 'unknown',
        phone: ''
      })
    }
    
    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 150))
  }
  
  return enrichedPeople
}

async function searchCompanies(params: ApolloSearchParams) {
  const data: Record<string, unknown> = {
    page: 1,
    per_page: Math.min(params.maxCompanies, 100),
    organization_num_employees_ranges: [`${params.employeeMin},${params.employeeMax}`],
    organization_locations: params.locations
  }
  
  if (params.industries.length > 0) {
    data.q_organization_keyword_tags = params.industries
  }
  
  return apolloRequest('/mixed_companies/search', data)
}

async function searchPeopleAtCompany(
  companyId: string, 
  titles: string[], 
  seniorities: string[],
  maxContacts: number
) {
  const data: Record<string, unknown> = {
    page: 1,
    per_page: Math.min(maxContacts, 25),
    organization_ids: [companyId],
    person_titles: titles,
    person_seniorities: seniorities
  }
  
  return apolloRequest('/mixed_people/api_search', data)
}

export async function POST(request: NextRequest) {
  try {
    if (!APOLLO_API_KEY) {
      return NextResponse.json(
        { error: 'Apollo API key not configured. Add APOLLO_API_KEY to .env.local' },
        { status: 500 }
      )
    }

    const params: ApolloSearchParams = await request.json()
    
    const results = {
      clientId: params.clientId,
      searchCriteria: {
        industries: params.industries,
        locations: params.locations,
        employeeRange: `${params.employeeMin}-${params.employeeMax}`,
        targetTitles: params.titles,
        timestamp: new Date().toISOString()
      },
      companies: [] as Array<{
        id: string
        name: string
        domain: string
        industry: string
        employeeCount: number
        location: string
        linkedinUrl: string
        description: string
        contacts: Array<{
          name: string
          title: string
          email: string
          emailStatus: string
          phone: string
          linkedinUrl: string
          seniority: string
        }>
      }>,
      summary: {
        totalCompanies: 0,
        totalContacts: 0,
        contactsWithEmail: 0
      }
    }

    // Step 1: Search companies
    console.log(`🔍 Searching companies for ${params.clientId}...`)
    const companiesResponse = await searchCompanies(params)
    const companies = companiesResponse.accounts || companiesResponse.organizations || []
    
    console.log(`   Found ${companies.length} companies`)

    // Collect all people for potential enrichment
    const allPeopleToEnrich: Array<PersonDetail & { companyIndex: number; contactIndex: number }> = []

    // Step 2: For each company, find decision makers
    for (const company of companies.slice(0, params.maxCompanies)) {
      const companyIndex = results.companies.length
      const companyData = {
        id: company.id || company.organization_id,
        name: company.name || 'N/A',
        domain: company.domain || company.primary_domain || company.website_url || 'N/A',
        industry: company.industry || 'N/A',
        employeeCount: company.estimated_num_employees || company.organization?.estimated_num_employees || 0,
        location: [company.city, company.state, company.country].filter(Boolean).join(', ') || company.organization?.city || '',
        linkedinUrl: company.linkedin_url || company.organization?.linkedin_url || '',
        description: (company.short_description || company.organization?.short_description || '').substring(0, 200),
        contacts: [] as Array<{
          id: string
          name: string
          title: string
          email: string
          emailStatus: string
          phone: string
          linkedinUrl: string
          seniority: string
        }>
      }

      // Search for decision makers at this company
      try {
        // Use organization_id (real org ID) instead of id (Apollo account ID)
        const orgIdForPeopleSearch = company.organization_id || company.id
        
        const peopleResponse = await searchPeopleAtCompany(
          orgIdForPeopleSearch,
          params.titles,
          params.seniorities,
          params.maxContactsPerCompany
        )
        
        const people = peopleResponse.people || []
        
        for (const person of people.slice(0, params.maxContactsPerCompany)) {
          const contactIndex = companyData.contacts.length
          const contact = {
            id: person.id || '',
            name: [person.first_name, person.last_name].filter(Boolean).join(' ') || 'N/A',
            title: person.title || 'N/A',
            email: person.email || '',
            emailStatus: person.email_status || 'unknown',
            phone: person.phone_number || person.sanitized_phone || '',
            linkedinUrl: person.linkedin_url || '',
            seniority: person.seniority || ''
          }
          companyData.contacts.push(contact)
          
          // Collect for enrichment if needed
          if (params.enrichContacts && !contact.email) {
            allPeopleToEnrich.push({
              id: person.id,
              first_name: person.first_name,
              last_name: person.last_name,
              organization_name: companyData.name,
              domain: companyData.domain,
              linkedin_url: person.linkedin_url,
              companyIndex,
              contactIndex
            })
          }
          
          results.summary.totalContacts++
          if (contact.email) {
            results.summary.contactsWithEmail++
          }
        }
      } catch (error: unknown) {
        // 403 errors are expected if Apollo plan doesn't include people search
        const errorMsg = error instanceof Error ? error.message : 'Unknown error'
        if (!errorMsg.includes('403')) {
          console.error(`Error getting contacts for ${company.name}:`, error)
        }
      }

      results.companies.push(companyData)
      results.summary.totalCompanies++
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    // Step 3: Enrich contacts to get emails and phones (optional, uses credits)
    if (params.enrichContacts && allPeopleToEnrich.length > 0) {
      console.log(`📧 Enriching ${allPeopleToEnrich.length} contacts...`)
      
      const enrichedData = await enrichPeopleBulk(allPeopleToEnrich)
      
      // Map enriched data back to contacts
      for (let i = 0; i < enrichedData.length && i < allPeopleToEnrich.length; i++) {
        const personRef = allPeopleToEnrich[i]
        const enriched = enrichedData[i]
        
        if (enriched && results.companies[personRef.companyIndex]) {
          const contact = results.companies[personRef.companyIndex].contacts[personRef.contactIndex]
          if (contact && enriched.email) {
            contact.email = enriched.email
            contact.emailStatus = enriched.emailStatus
            results.summary.contactsWithEmail++
          }
          if (contact && enriched.phone) {
            contact.phone = enriched.phone
          }
        }
      }
      
      console.log(`   Enrichment complete. Found ${results.summary.contactsWithEmail} emails.`)
    }

    return NextResponse.json(results)
    
  } catch (error) {
    console.error('Apollo search error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Test endpoint
export async function GET() {
  if (!APOLLO_API_KEY) {
    return NextResponse.json({ 
      status: 'error', 
      message: 'APOLLO_API_KEY not configured' 
    })
  }
  
  try {
    const response = await apolloRequest('/mixed_companies/search', {
      page: 1,
      per_page: 1
    })
    
    return NextResponse.json({ 
      status: 'connected',
      message: 'Apollo API connection successful',
      totalCompanies: response.pagination?.total_entries || 'N/A'
    })
  } catch (error) {
    return NextResponse.json({ 
      status: 'error',
      message: error instanceof Error ? error.message : 'Connection failed'
    })
  }
}
