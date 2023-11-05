import * as prismaSchema from '@prisma/client';
import { Action } from '@prisma/client'
import * as apiSchema from './apiSchema';
import createModuleLogger from '../src/logger';

const logger = createModuleLogger('Prisma Calls');
const prisma = new prismaSchema.PrismaClient();

export async function getMetaDataByQuery(queryName: apiSchema.PackageName, minVersion: string, maxVersion: string, minInclusive: boolean, maxInclusive: boolean, offset : number): Promise<prismaSchema.PackageMetadata[] | null> {
    try {
        // Ensure that the offset is at least 1 (treat 0 as page 1)
        const page = Math.max(1, offset);

        // Calculate the number of records to skip based on the page number and page size
        const pageSize = 10;
        const recordsToSkip = (page - 1) * pageSize;

        const whereCondition = {
            version: {
            [minInclusive ? 'gte' : 'gt']: maxVersion,
            [maxInclusive ? 'lte' : 'lt']: minVersion,
            },
        };

        if (queryName !== '*') {
            (whereCondition as any).name = queryName;
        }

        const packages = await prisma.packageMetadata.findMany({
            where: whereCondition,
            skip: recordsToSkip, // Use skip to implement pagination
            take: pageSize, // Specify the number of records to retrieve for the current page
        });

        return packages;
    } catch (error) {
        logger.info(`Error in getMetaDataArray: ${error}`);
        return null;
    }
}

export async function getPackageHistories(queryName: apiSchema.PackageName) {
    try {
        const packageHistories = await prisma.packageHistoryEntry.findMany({
            where: {
                metadata: {
                    name: queryName,
                },
            },
            include: {
                user: true,
                metadata: true,
            },
        });
        return packageHistories;
    } catch (error) {
        logger.info(`Error in getPackageHistories: ${error}`);
        return null;
    }
}

export async function uploadMetadataToDatabase(metadata: apiSchema.PackageMetadata): Promise<void> {
    try {
        await prisma.packageMetadata.create({
            data: {
                name: metadata.Name,
                version: metadata.Version,
                id: metadata.ID
            }
        });
    } catch (error) {
        logger.info(`Error in uploadMetadataToDatabase: ${error}`);
        throw new Error('Failed to upload metadata to the database.');
    }
}

export async function createPackageHistoryEntry(metadataId: string, userId: number, action: Action): Promise<void> {
    try {
        // Check if metadataId exists
        const metadataExists = await prisma.packageMetadata.findUnique({
            where: { id: metadataId },
        });
        if (!metadataExists) {
            throw new Error(`No metadata found for ID: ${metadataId}`);
        }

        // Check if userId exists
        const userExists = await prisma.user.findUnique({
            where: { id: userId },
        });
        if (!userExists) {
            throw new Error(`No user found for ID: ${userId}`);
        }

        // Create PackageHistoryEntry
        await prisma.packageHistoryEntry.create({
            data: {
                metadataId: metadataId,
                userId: userId,
                action: action,
                date: new Date(),
            }
        });
    } catch (error) {
        logger.info(`Error in createPackageHistoryEntry: ${error}`);
        throw new Error('Failed to create package history entry in the database.');
    }
}

export async function checkPackageHistoryExists(metadataId: string): Promise<boolean> {
    const count = await prisma.packageHistoryEntry.count({
        where: {
            metadataId: metadataId,
        },
    });
    return count > 0;
}

export async function getMetaDataByRegEx(regEx: string): Promise<prismaSchema.PackageMetadata[] | null> {
    const timeoutPromise = new Promise<prismaSchema.PackageMetadata[] | null>((_, reject) => {
        setTimeout(() => {
            reject(new Error('Query timeout after 5 seconds'));
        }, 5000);
    });

    try {
        const packagesPromise = prisma.packageMetadata.findMany({
            where: {
                name: {
                    contains: regEx,
                },
            },
        });

        const result = await Promise.race([packagesPromise, timeoutPromise]);

        return result;
    } catch (error) {
        console.error(`Error in getMetaDataArray: ${error}`);
        return null;
    }
}

export async function storeMetricsInDatabase(metadataId: string, packageRating: apiSchema.PackageRating): Promise<void> {
    try {
        await prisma.packageRating.create({
            data: {
                metadataId: metadataId, 
                busFactor: packageRating.BusFactor,
                correctness: packageRating.Correctness,
                rampUp: packageRating.RampUp,
                responsiveMaintainer: packageRating.ResponsiveMaintainer,
                licenseScore: packageRating.LicenseScore,
                goodPinningPractice: packageRating.GoodPinningPractice,
                pullRequest: packageRating.PullRequest,
                netScore: packageRating.NetScore,
            }
        });

        logger.info('Package rating metrics stored in the database successfully.');
    } catch (error) {
        logger.info(`Error in storeMetricsInDatabase: ${error}`);
        throw new Error('Failed to store package rating metrics in the database.');
    }
}

export async function getPackage(queryID: apiSchema.PackageID): Promise<apiSchema.Package | null> {
	// Assume this type is equivalent to the Prisma package type
	try {
		const packageEntry = await prisma.package.findFirst({
			where: {
				metadata: {
					id: queryID,
				},
			},
			include: {
				data: true,
				metadata: true,
			},
		});
		return packageEntry as unknown as apiSchema.Package;
	} catch (error) {
		console.error(`Error in getPackage: ${error}`);
		return null;
	}
}

// For update endpoint
export async function updatePackageDetails(
	packageId: apiSchema.PackageID,
	packageData: apiSchema.PackageData,
): Promise<apiSchema.PackageData | null> {
	try {
		// metadata has been validated in updatePackage
		const updatedData = await prisma.packageData.update({
			where: { id: packageId },
			data: {
				content: packageData.Content ?? '', // nullish  to handle optional fields
				URL: packageData.URL ?? '',
				JSProgram: packageData.JSProgram ?? '',
			},
		});

		// Return the updated package data
		return {
			Content: updatedData.content,
			URL: updatedData.URL,
			JSProgram: updatedData.JSProgram,
		};
	} catch (error) {
		console.error(`Error in updatePackageDetails: ${error}`);
		return null;
	}
}

export async function checkMetricsExist(metadataId: string): Promise<boolean> {
    try {
        const existingMetrics = await prisma.packageRating.findUnique({
            where: { metadataId: metadataId },
        });
        return existingMetrics !== null;
    } catch (error) {
        logger.error(`Error in checkMetricsExist: ${error}`);
        throw error;
    }
}