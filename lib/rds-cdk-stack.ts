import { Stack, StackProps } from 'aws-cdk-lib';
import { Vpc, SubnetType, SecurityGroup, Peer, Port, Instance, InstanceType, InstanceClass, InstanceSize, AmazonLinuxImage, AmazonLinuxGeneration, CfnKeyPair } from 'aws-cdk-lib/aws-ec2';
import { Construct } from 'constructs';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as cdk from 'aws-cdk-lib';
// import * as sqs from 'aws-cdk-lib/aws-sqs';

export class RdsCdkStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    // create the VPC
    const vpc = new Vpc(this, 'rds-cdk-vpc', {
      cidr: '10.0.0.0/16',
      natGateways: 0,
      maxAzs: 3,
      subnetConfiguration: [
        // Public subnet
        {
          name: 'public-subnet-1',
          subnetType: SubnetType.PUBLIC,
          cidrMask: 24,
        },
        // Isolated subnet
        {
          name: 'isolated-subnet-1',
          subnetType: SubnetType.PRIVATE_ISOLATED,
          cidrMask: 28,
        },
      ],
    });

    // create a security group for the EC2 instance, publice
    const publicSG = new SecurityGroup(this, 'ec2-instance-sg', {
      vpc,
    });

    publicSG.addIngressRule(
      Peer.anyIpv4(),
      Port.tcp(22),
      'allow SSH connections from anywhere',
    );

    
    // create the EC2 instance
    const ec2Instance = new Instance(this, 'ec2-instance', {
      vpc,
      vpcSubnets: {
        subnetType: SubnetType.PUBLIC,
      },
      securityGroup: publicSG,
      instanceType: InstanceType.of(
        InstanceClass.BURSTABLE2,
        InstanceSize.MICRO,
      ),
      machineImage: new AmazonLinuxImage({
        generation: AmazonLinuxGeneration.AMAZON_LINUX_2,
      }),
      keyName: 'chuchu',
    });

    // 👇 create RDS instance
    const dbInstance = new rds.DatabaseInstance(this, 'db-instance', {
      vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      engine: rds.DatabaseInstanceEngine.mysql({
        version: rds.MysqlEngineVersion.VER_8_0_28,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.BURSTABLE3,
        ec2.InstanceSize.MICRO,
      ),
      credentials: rds.Credentials.fromGeneratedSecret('admin'),
      multiAz: false,
      allocatedStorage: 100,
      maxAllocatedStorage: 105,
      allowMajorVersionUpgrade: false,
      autoMinorVersionUpgrade: true,
      backupRetention: cdk.Duration.days(0),
      deleteAutomatedBackups: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      deletionProtection: false,
      databaseName: 'rdstestDB',
      publiclyAccessible: false,
    });

    dbInstance.connections.allowFrom(ec2Instance, ec2.Port.tcp(3306)); // port# 3306 for MySQL

    new cdk.CfnOutput(this, 'dbEndpoint', {
      value: dbInstance.instanceEndpoint.hostname,
    });

    new cdk.CfnOutput(this, 'secretName', {
      // eslint-disable-next-line @typescript-eslint/no-non-null-asserted-optional-chain
      value: dbInstance.secret?.secretName!,
    });
  }
}
